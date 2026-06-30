import { redirect } from 'next/navigation'

/** Admin home — always land on login (avoids blank splash + stale client bundle issues). */
export default function AdminHomePage() {
  redirect('/login')
}
