import { HeartPulse } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export interface HealthCalibration {
  id: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  calibration_type: string
  recommended_manager_action: string
  seller_focus: string
  mission_intensity_modifier: number
}

export function HealthCalibrationCard({ calibration }: { calibration: HealthCalibration }) {
  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <HeartPulse className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <p className="font-bold">Calibragem de saúde</p>
              <p className="mt-1 text-sm text-muted-foreground">{calibration.seller_focus}</p>
            </div>
          </div>
          <Badge variant={calibration.risk_level === 'high' || calibration.risk_level === 'critical' ? 'destructive' : 'outline'}>
            {calibration.risk_level}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{calibration.recommended_manager_action}</p>
      </CardContent>
    </Card>
  )
}
