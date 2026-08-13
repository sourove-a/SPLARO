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
  ) {
    return this.media.list(storeId, query, folder)
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
    },
  ) {
    return this.media.create(storeId, body)
  }

  @Patch(':id')
  update(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { name?: string; altText?: string | null; folder?: string },
  ) {
    return this.media.update(storeId, id, body)
  }

  @Delete('orphan')
  removeOrphan(
    @Query('storeId') storeId: string,
    @Body() body: { path?: string },
  ) {
    return this.media.removeOrphan(storeId, body.path ?? '')
  }

  @Delete(':id')
  remove(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.media.remove(storeId, id)
  }
}
