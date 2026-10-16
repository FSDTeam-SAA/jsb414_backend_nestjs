import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import config from './app/config';
import { validateEnvironment } from './app/config/validate-env';
import { setupApp } from './app/helper/setup-app';

async function bootstrap() {
  validateEnvironment(process.env);
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: config.env === 'production' }),
  });
  setupApp(app);

  if (config.env !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Foreclosure Gold API')
      .setDescription('Authentication, users and subscription plans')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  // Validation errors contain variable names only, never their values.
  console.error(
    error instanceof Error &&
      error.message.startsWith('Environment configuration:')
      ? error.message
      : 'Application startup failed. Check configuration and database availability.',
  );
  process.exitCode = 1;
});
