/**
 * Internal catalog rewards for demo:seed / demo:reset.
 * Shown on the student Marketplace for investor walkthroughs.
 */
export type DemoCatalogReward = {
  title: string
  description: string
  creditCost: number
}

export const DEMO_CATALOG_REWARDS: DemoCatalogReward[] = [
  {
    title: 'Entrada al cine (patrocinio)',
    description:
      'Boleto de cine financiado por un sponsor corporativo. Canje válido en cines aliados, sujeto a disponibilidad.',
    creditCost: 500,
  },
  {
    title: 'Beca de transporte ONG',
    description:
      'Apoyo financiado por una ONG aliada: vale mensual para transporte público hacia la escuela.',
    creditCost: 50,
  },
  {
    title: 'Kit de útiles escolares',
    description:
      'Paquete con cuadernos, lápices y material básico para apoyar tu siguiente periodo.',
    creditCost: 100,
  },
]
