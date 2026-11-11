import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PapersService } from "./papers.service";

@Controller("papers")
export class PapersController {
  constructor(private readonly papers: PapersService) {}

  @Post("ingest")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 30 * 1024 * 1024 } }))
  ingest(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: Record<string, unknown>) {
    return this.papers.ingest(file, body ?? {});
  }

  @Get()
  list(
    @Query("scope") scope?: string,
    @Query("yearFrom") yearFrom?: string,
    @Query("yearTo") yearTo?: string,
    @Query("tag") tag?: string,
    @Query("q") q?: string,
  ) {
    return this.papers.list({ scope, yearFrom, yearTo, tag, q });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.papers.get(id);
  }
}
