import { Injectable } from '@nestjs/common'
import { AdminHubService } from '../admin-hub/admin-hub.service'

@Injectable()
export class ContentService {
  constructor(private readonly hub: AdminHubService) {}

  overview(storeId: string) {
    return this.hub.contentOverview(storeId)
  }

  createBlog(
    storeId: string,
    body: { title: string; content?: string; excerpt?: string; status?: 'DRAFT' | 'PUBLISHED' },
  ) {
    return this.hub.createBlogPost(storeId, body)
  }
}
