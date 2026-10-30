import type { Metadata } from 'next';

import { messages } from '@/content/messages';
import { CakeBuilderView } from '@/features/builder/cake-builder-view';

export const metadata: Metadata = {
  title: messages.builder.title,
};

export default function BuilderPage() {
  return <CakeBuilderView />;
}
