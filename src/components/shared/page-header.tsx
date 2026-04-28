import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Texto do section label (obrigatório) — ex: "Visão Executiva" */
  label: string
  /** Ícone ou emoji para o section label */
  labelIcon?: ReactNode
  /** Título principal — h1 com gradient na palavra key */
  title: ReactNode
  /** Subtítulo muted abaixo do título */
  description?: string
  /** Elementos extras à direita (pills, botões) */
  actions?: ReactNode
  className?: string
}

/**
 * Header padrão de página conforme VAMO Design System.
 * Todas as telas devem começar com section label + h1 + subtítulo.
 */
export function PageHeader({
  label,
  labelIcon,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4 animate-fade-in-up', className)}>
      <div>
        {/* Section label */}
        <div className="section-label mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse flex-shrink-0" />
          {labelIcon && <span className="flex-shrink-0">{labelIcon}</span>}
          {label}
        </div>

        {/* Page title */}
        <h1 className="page-title">{title}</h1>

        {/* Description */}
        {description && (
          <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed max-w-lg">
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {actions && (
        <div className="hidden md:flex items-center gap-2 shrink-0 pb-0.5">
          {actions}
        </div>
      )}
    </div>
  )
}

/** Palavra em gradient verde para usar dentro do title */
export function TitleHighlight({ children }: { children: ReactNode }) {
  return <span className="text-gradient-primary">{children}</span>
}
