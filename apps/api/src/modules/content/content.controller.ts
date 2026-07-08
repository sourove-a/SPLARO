import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId, slugify } from '../../common/store.util'
import { ContentService } from './content.service'
import { LegalPagesService } from './legal-pages.service'
import { LEGAL_PAGE_SLUGS, type LegalPageContent } from '@splaro/types'

@Controller('admin/content')
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly prisma: PrismaService,
    private readonly legalPages: LegalPagesService,
  ) {}

  @Get('overview')
  overview(@Query('storeId') storeId: string) {
    return this.content.overview(storeId)
  }

  // ── Legal / policy pages ────────────────────────────────────

  @Get('legal-pages')
  listLegalPages(@Query('storeId') storeId: string) {
    return this.legalPages.list(storeId)
  }

  @Get('legal-pages/:slug')
  getLegalPage(@Query('storeId') storeId: string, @Param('slug') slug: string) {
    return this.legalPages.get(storeId, slug)
  }

  @Put('legal-pages/:slug')
  upsertLegalPage(
    @Query('storeId') storeId: string,
    @Param('slug') slug: string,
    @Body() body: LegalPageContent,
  ) {
    return this.legalPages.upsert(storeId, slug, body)
  }

  // ── Blog Posts ────────────────────────────────────────────

  @Get('blog')
  async listBlog(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const where = {
      storeId: sid,
      ...(status ? { status: status as never } : {}),
    }
    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        include: { category: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      this.prisma.blogPost.count({ where }),
    ])
    return { posts, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) }
  }

  @Get('blog/:id')
  async getBlog(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const post = await this.prisma.blogPost.findFirst({
      where: { id, storeId: sid },
      include: { category: true },
    })
    if (!post) throw new NotFoundException('Blog post not found')
    return post
  }

  @Post('blog')
  createBlog(
    @Query('storeId') storeId: string,
    @Body() body: { title: string; content?: string; excerpt?: string; status?: 'DRAFT' | 'PUBLISHED'; categoryId?: string; featuredImage?: string; tags?: string[] },
  ) {
    return this.content.createBlog(storeId, body)
  }

  @Patch('blog/:id')
  async updateBlog(
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string; excerpt?: string; status?: string; featuredImage?: string; tags?: string[]; metaTitle?: string; metaDesc?: string; storeId?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, body.storeId)
    const existing = await this.prisma.blogPost.findFirst({ where: { id, storeId: sid }, select: { id: true } })
    if (!existing) throw new NotFoundException('Blog post not found')

    const data: Record<string, unknown> = { ...body }
    delete data['storeId']
    if (body.status === 'PUBLISHED') {
      data['publishedAt'] = new Date()
    }
    return this.prisma.blogPost.update({ where: { id }, data: data as never })
  }

  @Delete('blog/:id')
  async deleteBlog(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const existing = await this.prisma.blogPost.findFirst({ where: { id, storeId: sid }, select: { id: true } })
    if (!existing) throw new NotFoundException('Blog post not found')

    await this.prisma.blogPost.delete({ where: { id } })
    return { deleted: true }
  }

  // ── Blog Categories ────────────────────────────────────────

  @Get('blog-categories')
  async listBlogCategories(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.blogCategory.findMany({
      where: { storeId: sid },
      include: { _count: { select: { posts: true } } },
      orderBy: { name: 'asc' },
    })
  }

  @Post('blog-categories')
  async createBlogCategory(@Query('storeId') storeId: string, @Body() body: { name: string }) {
    const sid = await resolveStoreId(this.prisma, storeId)
    let slug = slugify(body.name)
    const clash = await this.prisma.blogCategory.findUnique({ where: { storeId_slug: { storeId: sid, slug } } })
    if (clash) slug = `${slug}-${Date.now().toString(36)}`
    return this.prisma.blogCategory.create({ data: { storeId: sid, name: body.name, slug } })
  }

  @Delete('blog-categories/:id')
  async deleteBlogCategory(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const existing = await this.prisma.blogCategory.findFirst({ where: { id, storeId: sid }, select: { id: true } })
    if (!existing) throw new NotFoundException('Blog category not found')

    await this.prisma.blogCategory.delete({ where: { id } })
    return { deleted: true }
  }

  // ── Site Pages ─────────────────────────────────────────────

  @Get('pages')
  async listPages(@Query('storeId') storeId: string, @Query('kind') kind?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const legalSlugs = [...LEGAL_PAGE_SLUGS]
    return this.prisma.sitePage.findMany({
      where: {
        storeId: sid,
        ...(kind === 'landing'
          ? { isHomepage: false, slug: { notIn: legalSlugs } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  @Get('pages/:id')
  async getPage(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const page = await this.prisma.sitePage.findFirst({
      where: { id, storeId: sid },
      include: { contentBlocks: { orderBy: { createdAt: 'asc' } } },
    })
    if (!page) throw new NotFoundException('Page not found')
    return page
  }

  @Post('pages')
  async createPage(
    @Query('storeId') storeId: string,
    @Body() body: { title: string; content?: string; isPublished?: boolean; isHomepage?: boolean; metaTitle?: string; metaDesc?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    let slug = slugify(body.title)
    const clash = await this.prisma.sitePage.findUnique({ where: { storeId_slug: { storeId: sid, slug } } })
    if (clash) slug = `${slug}-${Date.now().toString(36)}`
    const defaultContent = JSON.stringify({
      title: body.title,
      description: body.metaDesc?.trim() || `${body.title} — SPLARO campaign landing page.`,
      sections: [
        {
          heading: 'Overview',
          body: 'Edit this copy from Admin → Content → Landing Pages.',
        },
      ],
    })
    return this.prisma.sitePage.create({
      data: {
        storeId: sid,
        title: body.title,
        slug,
        content: body.content ?? defaultContent,
        isPublished: body.isPublished ?? false,
        isHomepage: body.isHomepage ?? false,
        metaTitle: body.metaTitle ?? body.title,
        metaDesc: body.metaDesc,
      },
    })
  }

  @Patch('pages/:id')
  async updatePage(
    @Param('id') id: string,
    @Body() body: { title?: string; slug?: string; content?: string; isPublished?: boolean; customCss?: string; customJs?: string; metaTitle?: string; metaDesc?: string; storeId?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, body.storeId)
    const existing = await this.prisma.sitePage.findFirst({ where: { id, storeId: sid }, select: { id: true } })
    if (!existing) throw new NotFoundException('Page not found')

    const data: Record<string, unknown> = { ...body }
    delete data['storeId']
    if (body.slug) data.slug = slugify(body.slug)
    return this.prisma.sitePage.update({ where: { id }, data: data as never })
  }

  @Delete('pages/:id')
  async deletePage(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const existing = await this.prisma.sitePage.findFirst({ where: { id, storeId: sid }, select: { id: true } })
    if (!existing) throw new NotFoundException('Page not found')

    await this.prisma.sitePage.delete({ where: { id } })
    return { deleted: true }
  }

  // ── Menus ──────────────────────────────────────────────────

  @Get('menus')
  async listMenus(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.menu.findMany({
      where: { storeId: sid },
      include: {
        items: {
          where: { parentId: null },
          orderBy: { sortOrder: 'asc' },
          include: { children: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    })
  }

  @Get('menus/:handle')
  async getMenu(@Query('storeId') storeId: string, @Param('handle') handle: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const menu = await this.prisma.menu.findUnique({
      where: { storeId_handle: { storeId: sid, handle } },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { children: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    })
    if (!menu) throw new NotFoundException('Menu not found')
    return menu
  }

  @Post('menus')
  async createMenu(
    @Query('storeId') storeId: string,
    @Body() body: { name: string; handle: string },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.menu.create({ data: { storeId: sid, name: body.name, handle: body.handle } })
  }

  @Post('menus/:handle/items')
  async addMenuItem(
    @Query('storeId') storeId: string,
    @Param('handle') handle: string,
    @Body() body: { label: string; url?: string; resourceId?: string; type?: string; parentId?: string; sortOrder?: number },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const menu = await this.prisma.menu.findUnique({ where: { storeId_handle: { storeId: sid, handle } } })
    if (!menu) throw new NotFoundException('Menu not found')
    return this.prisma.menuItem.create({
      data: {
        menuId: menu.id,
        label: body.label,
        url: body.url,
        resourceId: body.resourceId,
        type: (body.type ?? 'LINK') as never,
        parentId: body.parentId,
        sortOrder: body.sortOrder ?? 0,
      },
    })
  }

  @Patch('menu-items/:id')
  async updateMenuItem(
    @Param('id') id: string,
    @Body() body: { label?: string; url?: string; isActive?: boolean; sortOrder?: number; storeId?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, body.storeId)
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, menu: { storeId: sid } },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Menu item not found')

    const data = { ...body }
    delete data.storeId
    return this.prisma.menuItem.update({ where: { id }, data: data as never })
  }

  @Delete('menu-items/:id')
  async deleteMenuItem(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, menu: { storeId: sid } },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Menu item not found')

    await this.prisma.menuItem.delete({ where: { id } })
    return { deleted: true }
  }
}
