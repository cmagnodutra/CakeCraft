import type { Metadata } from 'next';

import { messages } from '@/content/messages';
import { ProfileView } from '@/features/profile/profile-view';

export const metadata: Metadata = {
  title: messages.profile.title,
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfileView />;
}
