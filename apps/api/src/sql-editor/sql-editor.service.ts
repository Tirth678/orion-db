import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  FullQueryResults,
  NeonQueryFunction,
} from '@neondatabase/serverless';
import { and, desc, eq } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { projects, organizations, queryHistory } from '../db/schema';
import type { QueryResult } from '@orion/types';

@Injectable()
export class SqlEditorService {
  constructor(private drizzle: DrizzleService) {}

  private assertSafeIdentifier(name: string, label: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new BadRequestException(`Invalid ${label}: ${name}`);
    }
  }

  private static readonly BLOCKED_PATTERNS = [
    /\bDROP\s+DATABASE\b/i,
    /\bDROP\s+SCHEMA\b/i,
    /\bTRUNCATE\b/i,
  ];

  private parseStatements(querySql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let i = 0;
    const len = querySql.length;

    while (i < len) {
      if (querySql[i] === '-' && querySql[i + 1] === '-') {
        current += '--';
        i += 2;
        while (i < len && querySql[i] !== '\n') {
          current += querySql[i];
          i++;
        }
        continue;
      }

      if (querySql[i] === '/' && querySql[i + 1] === '*') {
        current += '/*';
        i += 2;
        let depth = 1;
        while (i < len && depth > 0) {
          if (querySql[i] === '/' && querySql[i + 1] === '*') {
            depth++;
            current += '/*';
            i += 2;
          } else if (querySql[i] === '*' && querySql[i + 1] === '/') {
            depth--;
            current += '*/';
            i += 2;
          } else {
            current += querySql[i];
            i++;
          }
        }
        continue;
      }

      if (querySql[i] === "'") {
        current += "'";
        i++;
        while (i < len) {
          if (querySql[i] === "'") {
            current += "'";
            if (querySql[i + 1] === "'") {
              current += "'";
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            current += querySql[i];
            i++;
          }
        }
        continue;
      }

      if (querySql[i] === '$') {
        const match = querySql.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
        if (match) {
          const tag = match[1];
          current += tag;
          i += tag.length;
          const endIdx = querySql.indexOf(tag, i);
          if (endIdx !== -1) {
            current += querySql.slice(i, endIdx + tag.length);
            i = endIdx + tag.length;
            continue;
          }
        }
      }

      if (querySql[i] === '"') {
        current += '"';
        i++;
        while (i < len) {
          if (querySql[i] === '"') {
            current += '"';
            if (querySql[i + 1] === '"') {
              current += '"';
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            current += querySql[i];
            i++;
          }
        }
        continue;
      }

      if (querySql[i] === ';') {
        const trimmed = current.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }
        current = '';
        i++;
        continue;
      }

      current += querySql[i];
      i++;
    }

    const trimmed = current.trim();
    if (trimmed.length > 0) {
      statements.push(trimmed);
    }

    if (statements.length === 0) {
      throw new BadRequestException('SQL query cannot be empty');
    }

    return statements;
  }

  private stripCommentsAndStrings(sql: string): string {
    let result = '';
    let i = 0;
    const len = sql.length;

    while (i < len) {
      if (sql[i] === '-' && sql[i + 1] === '-') {
        i += 2;
        while (i < len && sql[i] !== '\n') {
          i++;
        }
        result += ' ';
        continue;
      }

      if (sql[i] === '/' && sql[i + 1] === '*') {
        i += 2;
        let depth = 1;
        while (i < len && depth > 0) {
          if (sql[i] === '/' && sql[i + 1] === '*') {
            depth++;
            i += 2;
          } else if (sql[i] === '*' && sql[i + 1] === '/') {
            depth--;
            i += 2;
          } else {
            i++;
          }
        }
        result += ' ';
        continue;
      }

      if (sql[i] === "'") {
        i++;
        while (i < len) {
          if (sql[i] === "'") {
            if (sql[i + 1] === "'") {
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            i++;
          }
        }
        result += " '' ";
        continue;
      }

      if (sql[i] === '$') {
        const match = sql.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
        if (match) {
          const tag = match[1];
          i += tag.length;
          const endIdx = sql.indexOf(tag, i);
          if (endIdx !== -1) {
            i = endIdx + tag.length;
            result += " '' ";
            continue;
          }
        }
      }

      if (sql[i] === '"') {
        i++;
        while (i < len) {
          if (sql[i] === '"') {
            if (sql[i + 1] === '"') {
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            i++;
          }
        }
        result += ' "ident" ';
        continue;
      }

      result += sql[i];
      i++;
    }

    return result;
  }

  assertAllowedStatements(statements: string[]): void {
    for (const statement of statements) {
      const stripped = this.stripCommentsAndStrings(statement);
      if (
        SqlEditorService.BLOCKED_PATTERNS.some((pattern) =>
          pattern.test(stripped),
        )
      ) {
        throw new BadRequestException('This statement is not allowed');
      }
    }
  }

  private getNeonClient(): NeonQueryFunction<false, true> {
    const client = (
      this.drizzle.db as unknown as {
        $client: NeonQueryFunction<false, true>;
      }
    ).$client;

    if (!client?.transaction) {
      throw new Error('Neon HTTP client is not available');
    }

    return client;
  }

  private normalizePgResult(result: FullQueryResults<false>): {
    rows: Record<string, unknown>[];
    rowCount: number;
    command: string;
  } {
    const rows = (result.rows ?? []) as Record<string, unknown>[];

    return {
      rows,
      rowCount: result.rowCount ?? rows.length,
      command: result.command ?? 'SELECT',
    };
  }

  private async getProject(orgSlug: string, projectSlug: string) {
    const [row] = await this.drizzle.db
      .select({
        id: projects.id,
        dbSchema: projects.dbSchema,
      })
      .from(projects)
      .innerJoin(organizations, eq(projects.orgId, organizations.id))
      .where(
        and(eq(organizations.slug, orgSlug), eq(projects.slug, projectSlug)),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Project not found');
    return row;
  }

  async executeQuery(
    orgSlug: string,
    projectSlug: string,
    querySql: string,
  ): Promise<QueryResult> {
    const project = await this.getProject(orgSlug, projectSlug);
    const statements = this.parseStatements(querySql);

    this.assertAllowedStatements(statements);

    this.assertSafeIdentifier(project.dbSchema, 'project schema');

    const start = Date.now();

    try {
      const neonSql = this.getNeonClient();

      const results = await neonSql.transaction(
        (txn) => [
          txn`SET LOCAL search_path TO ${txn.unsafe(`"${project.dbSchema}", public`)}`,
          ...statements.map((stmt) => txn`${txn.unsafe(stmt)}`),
        ],
        { fullResults: true, readOnly: false },
      );

      const executionTimeMs = Date.now() - start;

      // Find the last SELECT statement to return its results
      let lastSelectResult: {
        rows: Record<string, unknown>[];
        rowCount: number;
        command: string;
      } | null = null;
      for (let i = results.length - 1; i >= 0; i--) {
        const result = this.normalizePgResult(results[i]);
        if (result.command === 'SELECT') {
          lastSelectResult = result;
          break;
        }
      }

      // If no SELECT, return the last statement's result
      const finalResult = lastSelectResult || this.normalizePgResult(results[results.length - 1]);
      const { rows, rowCount, command } = finalResult;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      await this.drizzle.db.insert(queryHistory).values({
        projectId: project.id,
        sql: querySql,
        executionTimeMs,
        rowCount,
      });

      return {
        rows,
        columns,
        rowCount,
        executionTimeMs,
        command,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Query failed';
      throw new BadRequestException(message);
    }
  }

  async getHistory(orgSlug: string, projectSlug: string) {
    const project = await this.getProject(orgSlug, projectSlug);

    return this.drizzle.db
      .select()
      .from(queryHistory)
      .where(eq(queryHistory.projectId, project.id))
      .orderBy(desc(queryHistory.createdAt))
      .limit(50);
  }
}
