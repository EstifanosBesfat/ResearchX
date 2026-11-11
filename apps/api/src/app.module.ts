import { Module } from "@nestjs/common";
import { DatabaseService } from "./db/database.service";
import { EmbeddingsService } from "./embeddings/embeddings.service";
import { LlmService } from "./llm/llm.service";
import { PapersController } from "./papers/papers.controller";
import { PapersService } from "./papers/papers.service";
import { ResearchController } from "./research/research.controller";
import { ResearchService } from "./research/research.service";

@Module({
  controllers: [ResearchController, PapersController],
  providers: [DatabaseService, EmbeddingsService, LlmService, ResearchService, PapersService],
})
export class AppModule {}
