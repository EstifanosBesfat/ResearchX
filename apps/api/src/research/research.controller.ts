import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { askRequestSchema, type AskResponse, type HistoryItem, type ResearchRecord } from "@researchx/shared";
import { parseBody } from "../common/parse-body";
import { ResearchService } from "./research.service";

@Controller("research")
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  @Post("ask")
  ask(@Body() body: unknown): Promise<AskResponse> {
    return this.research.ask(parseBody(askRequestSchema, body));
  }

  @Get("history")
  history(): Promise<HistoryItem[]> {
    return this.research.history();
  }

  @Get(":id/sources")
  sources(@Param("id") id: string) {
    return this.research.sources(id);
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<ResearchRecord> {
    return this.research.get(id);
  }
}
