import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/http-exception.filter";
import { loadEnv } from "./env";

async function bootstrap(): Promise<void> {
  loadEnv();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  const allowedOrigins = (process.env.WEB_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      const localDev =
        process.env.NODE_ENV !== "production" &&
        Boolean(origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
      if (!origin || allowedOrigins.includes(origin) || localDev) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  const port = Number(process.env.API_PORT || 3001);
  await app.listen(port);
}

void bootstrap();
