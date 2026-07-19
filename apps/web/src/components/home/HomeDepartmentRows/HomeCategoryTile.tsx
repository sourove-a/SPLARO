import Image from 'next/image'
import Link from 'next/link'
import type { HomepageCategoryTile } from '@/lib/catalog/homepage-department-rows'
import { cn } from '@/lib/utils/cn'

interface HomeCategoryTileProps {
  tile: HomepageCategoryTile
  priority?: boolean
  active?: boolean
}

export function HomeCategoryTile({
  tile,
  priority = false,
  active = false,
}: HomeCategoryTileProps) {
  return (
    <Link
      href={tile.href}
      className={cn('home-dept-tile', active && 'is-active')}
      scroll={false}
    >
      <div className="home-dept-tile__media">
        <Image
          src={tile.image}
          alt={tile.label}
          fill
          sizes="(max-width: 767px) 72vw, (max-width: 1279px) 28vw, 22vw"
          className="home-dept-tile__img"
          {...(priority ? { priority: true } : { loading: 'lazy' as const })}
        />
        <span className="home-dept-tile__gradient" aria-hidden />
        <span className="home-dept-tile__label">{tile.label}</span>
      </div>
    </Link>
  )
}
