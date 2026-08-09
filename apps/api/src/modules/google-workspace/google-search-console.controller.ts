import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { canWriteAdmin, type AdminSessionPayload } from '../../common/auth/admin-session.util'
import { GoogleSearchConsoleService } from './google-search-console.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@Controller('admin/google/search-console')
export class GoogleSearchConsoleController {
  constructor(private readonly gsc: GoogleSearchConsoleService) {}

  private assertWrite(req: AdminRequest) {
    const role = req.adminUser?.role
    if (!role || !canWriteAdmin(role)) throw new ForbiddenException('Insufficient permissions')
    return req.adminUser!.userId
  }

  @Get('status')
  status(@Query('storeId') storeId: string) {
    return this.gsc.getStatus(storeId)
  }

  @Get('performance')
  performance(@Query('storeId') storeId: string, @Query('range') range?: string) {
    return this.gsc.getPerformance(storeId, range)
  }

  @Get('queries')
  queries(
    @Query('storeId') storeId: string,
    @Query('range') range?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.gsc.getQueries(storeId, range, limit, sort)
  }

  @Get('pages')
  pages(
    @Query('storeId') storeId: string,
    @Query('range') range?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.gsc.getPages(storeId, range, limit, sort)
  }

  @Get('sitemaps')
  sitemaps(@Query('storeId') storeId: string) {
    return this.gsc.getSitemaps(storeId)
  }

  @Get('insights')
  insights(@Query('storeId') storeId: string, @Query('range') range?: string) {
    return this.gsc.getInsights(storeId, range)
  }

  @Post('inspect')
  inspect(
    @Query('storeId') storeId: string,
    @Body() body: { url?: string },
    @Req() req: AdminRequest,
  ) {
    this.assertWrite(req)
    const url = body.url?.trim()
    if (!url) throw new BadRequestException('URL is required.')
    return this.gsc.inspectUrl(storeId, url)
  }

  @Post('refresh')
  refresh(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    this.assertWrite(req)
    return this.gsc.refresh(storeId)
  }
}
