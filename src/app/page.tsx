import { enrichedDCs, powerPlants, btmSiting, economics, regulatory, kpis } from '@/lib/data'
import { MapApp } from '@/components/MapApp'

export default function Home() {
  return (
    <MapApp
      dataCenters={enrichedDCs}
      powerPlants={powerPlants}
      btmSiting={btmSiting}
      economics={economics}
      regulatory={regulatory}
      kpis={kpis}
    />
  )
}
