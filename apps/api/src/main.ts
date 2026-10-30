import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new IoAdapter(app));

  app.use(cookieParser());

  app.setGlobalPrefix('api'); // /api/....

  app.useGlobalPipes( // strip non required data
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  // app.enableCors({
  //   origin: (origin, callback) => {
  //     // allow server-to-server / curl (no Origin header)
  //     if (!origin) return callback(null, true);

  //     const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
  //     if (origin === webUrl) return callback(null, true);

  //     // SDK demo: npx serve . from packages/orion-js (any localhost port)
  //     if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
  //       return callback(null, true);
  //     }

  //     callback(new Error(`CORS blocked: ${origin}`));
  //   },
  //   credentials: true,
  // });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}
void bootstrap();
