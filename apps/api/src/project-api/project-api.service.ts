import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { projects } from '../db/schema';
import { parseQueryParams, buildWhereClause } from './query-parser';

@Injectable()
export class ProjectApiService {
  constructor(private drizzle: DrizzleService) {}

  private assertSafeIdentifier(name: string, label: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new BadRequestException(`Invalid ${label}: ${name}`);
    }
  }

  async resolveProjectSchema(
    projectId: string,
    projectSlug: string,
  ): Promise<string> {
    const [project] = await this.drizzle.db
      .select({ dbSchema: projects.dbSchema, slug: projects.slug })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) throw new NotFoundException('Project not found');

    if (project.slug !== projectSlug) {
      throw new ForbiddenException('API key does not match this project URL');
    }

    return project.dbSchema;
  }

  private async getPrimaryKeyColumn(
    schema: string,
    tableName: string,
  ): Promise<string> {
    const result = await this.drizzle.db.execute<{ column_name: string }>(sql`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = ${schema}
        AND tc.table_name = ${tableName}
      ORDER BY kcu.ordinal_position ASC
      LIMIT 1
    `);

    const pk = result.rows[0]?.column_name;
    if (!pk) {
      throw new BadRequestException(`Table "${tableName}" has no primary key`);
    }

    return pk;
  }

  async getRows(
    projectId: string,
    projectSlug: string,
    tableName: string,
    rawParams: Record<string, string>,
  ) {
    this.assertSafeIdentifier(tableName, 'table name');
    const schema = await this.resolveProjectSchema(projectId, projectSlug);
    const { select, filters, orderBy, limit, offset } =
      parseQueryParams(rawParams);

    const columnsSql =
      select.length > 0
        ? sql.join(
            select.map((c) => sql.identifier(c)),
            sql`, `,
          )
        : sql`*`;

    const whereSql = buildWhereClause(filters);
    const orderSql = orderBy
      ? sql` ORDER BY ${sql.identifier(orderBy.column)} ${sql.raw(orderBy.direction)}`
      : sql.empty();

    const query = sql`
      SELECT ${columnsSql}
      FROM ${sql.identifier(schema)}.${sql.identifier(tableName)}
      ${whereSql ? sql` WHERE ${whereSql}` : sql.empty()}
      ${orderSql}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const result =
      await this.drizzle.db.execute<Record<string, unknown>>(query);
    return result.rows;
  }

  async insertRow(
    projectId: string,
    projectSlug: string,
    tableName: string,
    body: Record<string, unknown>,
  ) {
    this.assertSafeIdentifier(tableName, 'table name');
    const schema = await this.resolveProjectSchema(projectId, projectSlug);

    const entries = Object.entries(body);
    if (entries.length === 0) {
      throw new BadRequestException('Request body cannot be empty');
    }

    entries.forEach(([col]) => this.assertSafeIdentifier(col, 'column name'));

    const columnsSql = sql.join(
      entries.map(([c]) => sql.identifier(c)),
      sql`, `,
    );
    const valuesSql = sql.join(
      entries.map(([, v]) => {
        if (v !== null && typeof v === 'object') {
          return sql`${JSON.stringify(v)}::jsonb`;
        }
        return sql`${v}`;
      }),
      sql`, `,
    );

    const query = sql`
      INSERT INTO ${sql.identifier(schema)}.${sql.identifier(tableName)} (${columnsSql})
      VALUES (${valuesSql})
      RETURNING *
    `;

    const result =
      await this.drizzle.db.execute<Record<string, unknown>>(query);
    return result.rows[0];
  }

  async updateRow(
    projectId: string,
    projectSlug: string,
    tableName: string,
    rowId: string,
    body: Record<string, unknown>,
  ) {
    this.assertSafeIdentifier(tableName, 'table name');
    const schema = await this.resolveProjectSchema(projectId, projectSlug);

    let pkColumn: string;
    try {
      pkColumn = await this.getPrimaryKeyColumn(schema, tableName);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(
          `Cannot update table "${tableName}": ${error.message}. UPDATE and DELETE operations require tables to have a primary key.`,
        );
      }
      throw error;
    }

    const entries = Object.entries(body);
    if (entries.length === 0) {
      throw new BadRequestException('Request body cannot be empty');
    }

    entries.forEach(([col]) => this.assertSafeIdentifier(col, 'column name'));

    const setClausesSql = sql.join(
      entries.map(([col, val]) => {
        if (val !== null && typeof val === 'object') {
          return sql`${sql.identifier(col)} = ${JSON.stringify(val)}::jsonb`;
        }
        return sql`${sql.identifier(col)} = ${val}`;
      }),
      sql`, `,
    );

    const query = sql`
      UPDATE ${sql.identifier(schema)}.${sql.identifier(tableName)}
      SET ${setClausesSql}
      WHERE ${sql.identifier(pkColumn)} = ${rowId}
      RETURNING *
    `;

    const result =
      await this.drizzle.db.execute<Record<string, unknown>>(query);
    if (!result.rows[0]) throw new NotFoundException('Row not found');
    return result.rows[0];
  }

  async deleteRow(
    projectId: string,
    projectSlug: string,
    tableName: string,
    rowId: string,
  ) {
    this.assertSafeIdentifier(tableName, 'table name');
    const schema = await this.resolveProjectSchema(projectId, projectSlug);

    let pkColumn: string;
    try {
      pkColumn = await this.getPrimaryKeyColumn(schema, tableName);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(
          `Cannot delete from table "${tableName}": ${error.message}. UPDATE and DELETE operations require tables to have a primary key.`,
        );
      }
      throw error;
    }

    const query = sql`
      DELETE FROM ${sql.identifier(schema)}.${sql.identifier(tableName)}
      WHERE ${sql.identifier(pkColumn)} = ${rowId}
      RETURNING *
    `;

    const result =
      await this.drizzle.db.execute<Record<string, unknown>>(query);
    if (!result.rows[0]) throw new NotFoundException('Row not found');
    return result.rows[0];
  }
}
