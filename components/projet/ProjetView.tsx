'use client';

import { useState } from 'react';
import type { Projet, LayoutChoice } from '@/types/projet';
import LayoutEditorial from '@/components/layouts/LayoutEditorial';
import LayoutMagazine from '@/components/layouts/LayoutMagazine';
import ProjetToolbar from './ProjetToolbar';

interface Props {
  projet: Projet;
  isPrint: boolean;
}

export default function ProjetView({ projet, isPrint }: Props) {
  const [layout, setLayout] = useState<LayoutChoice>(projet.layout);

  function handleLayoutChange(newLayout: LayoutChoice) {
    setLayout(newLayout);
    fetch(`/api/projet/${projet.slug}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: newLayout }),
    }).catch(console.error);
  }

  return (
    <>
      {!isPrint && (
        <ProjetToolbar
          slug={projet.slug}
          urlWordpress={projet.urlWordpress}
          layout={layout}
          onLayoutChange={handleLayoutChange}
        />
      )}
      {layout === 'Magazine'
        ? <LayoutMagazine projet={{ ...projet, layout }} />
        : <LayoutEditorial projet={{ ...projet, layout }} />
      }
    </>
  );
}
