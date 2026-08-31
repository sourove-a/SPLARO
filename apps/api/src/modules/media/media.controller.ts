import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { MediaService } from './media.service'

@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(
    @Query('storeId') storeId: string,
    @Query('q') query?: string,
    @Query('folder') folder?: string,
    @Query('trash') trash?: string,
    @Query('duplicates') duplicates?: string,
  ) {
    return this.media.list(storeId, query, folder, {
      trash: trash === '1' || trash === 'true',
      duplicates: duplicates === '1' || duplicates === 'true',
    })
  }

  @Get('folders')
  folders(@Query('storeId') storeId: string) {
    return this.media.listFolders(storeId)
  }

  @Get('storage')
  storage(@Query('storeId') storeId: string, @Query('refresh') refresh?: string) {
    return this.media.storage(storeId, { refresh: refresh === '1' || refresh === 'true' })
  }

  @Get('orphans')
  orphans(
    @Query('storeId') storeId: string,
    @Query('refresh') refresh?: string,
    @Query('limit') limit?: string,
  ) {
    return this.media.orphans(storeId, {
      refresh: refresh === '1' || refresh === 'true',
      ...(limit ? { limit: Number(limit) } : {}),
    })
  }

  @Post('orphans/purge')
  purgeOrphans(@Query('storeId') storeId: string, @Body() body: { paths?: string[] }) {
    return this.media.purgeOrphans(storeId, body.paths ?? [])
  }

  @Post('bulk-move')
  bulkMove(@Query('storeId') storeId: string, @Body() body: { ids?: string[]; folder?: string }) {
    return this.media.bulkMove(storeId, body.ids ?? [], body.folder ?? '')
  }

  @Post('bulk-purge')
  bulkPurge(@Query('storeId') storeId: string, @Body() body: { ids?: string[] }) {
    return this.media.bulkPurge(storeId, body.ids ?? [])
  }

  @Get('usage')
  usageByPath(@Query('storeId') storeId: string, @Query('path') path?: string) {
    return this.media.usageForPath(storeId, path ?? '')
  }

  @Get('product-usage')
  productUsage(@Query('storeId') storeId: string, @Query('exceptProductId') exceptProductId?: string) {
    return this.media.productUsagePaths(storeId, exceptProductId)
  }

  @Post('folders')
  createFolder(
    @Query('storeId') storeId: string,
    @Body() body: { label?: string; parentSlug?: string },
  ) {
    return this.media.createFolder(storeId, body.label ?? '', body.parentSlug)
  }

  @Patch('folders/:slug')
  renameFolder(
    @Query('storeId') storeId: string,
    @Param('slug') slug: string,
    @Body() body: { label?: string },
  ) {
    return this.media.renameFolder(storeId, decodeURIComponent(slug), body.label ?? '')
  }

  @Delete('folders/:slug')
  deleteFolder(@Query('storeId') storeId: string, @Param('slug') slug: string) {
    return this.media.deleteFolder(storeId, decodeURIComponent(slug))
  }

  @Post()
  create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      name: string
      path: string
      altText?: string | null
      folder?: string
      mimeType?: string | null
      sizeBytes?: number | null
      width?: number | null
      height?: number | null
      contentHash?: string | null
      kind?: string | null
      focalX?: number | null
      focalY?: number | null
      watermarked?: boolean
    },
  ) {
    return this.media.create(storeId, body)
  }

  @Post('bulk-delete')
  bulkDelete(@Query('storeId') storeId: string, @Body() body: { ids?: string[] }) {
    return this.media.bulkSoftDelete(storeId, body.ids ?? [])
  }

  @Delete('trash')
  emptyTrash(@Query('storeId') storeId: string) {
    return this.media.emptyTrash(storeId)
  }

  @Delete('orphan')
  removeOrphan(
    @Query('storeId') storeId: string,
    @Body() body: { path?: string },
  ) {
    return this.media.removeOrphan(storeId, body.path ?? '')
  }

  @Get(':id/usage')
  usageForAsset(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.media.usageForAsset(storeId, id)
  }

  @Post(':id/restore')
  restore(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.media.restore(storeId, id)
  }

  @Post(':id/replace')
  replace(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body()
    body: {
      path?: string
      mimeType?: string
      sizeBytes?: number
      width?: number
      height?: number
      contentHash?: string
      kind?: string
    },
  ) {
    return this.media.replaceFile(storeId, id, { path: body.path ?? '', ...body })
  }

  @Patch(':id')
  update(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string
      altText?: string | null
      folder?: string
      focalX?: number | null
      focalY?: number | null
      watermarked?: boolean
    },
  ) {
    return this.media.update(storeId, id, body)
  }

  @Delete(':id')
  remove(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Query('permanent') permanent?: string,
  ) {
    return this.media.remove(storeId, id, {
      permanent: permanent === '1' || permanent === 'true',
    })
  }
}
