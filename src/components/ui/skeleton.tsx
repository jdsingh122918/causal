import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

/**
 * Text skeleton for simulating text lines
 */
interface TextSkeletonProps {
  lines?: number
  className?: string
  /** Width variation for more realistic text simulation */
  randomWidth?: boolean
}

function TextSkeleton({ lines = 1, className, randomWidth = true, ...props }: TextSkeletonProps) {
  const widths = randomWidth
    ? ['w-full', 'w-11/12', 'w-5/6', 'w-4/5', 'w-3/4', 'w-2/3']
    : ['w-full']

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            randomWidth
              ? widths[i % widths.length]
              : "w-full"
          )}
        />
      ))}
    </div>
  )
}

/**
 * Card skeleton for project/recording cards
 */
function CardSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-sm", className)} {...props}>
      <div className="space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />

        {/* Description lines */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Metadata */}
        <div className="flex items-center space-x-4 pt-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  )
}

/**
 * List skeleton for project/recording lists
 */
interface ListSkeletonProps {
  items?: number
  className?: string
}

function ListSkeleton({ items = 3, className, ...props }: ListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: items }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Log entry skeleton for diagnostics page
 */
function LogEntrySkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center space-x-4 p-2", className)} {...props}>
      {/* Timestamp */}
      <Skeleton className="h-4 w-16 flex-shrink-0" />

      {/* Level */}
      <Skeleton className="h-4 w-12 flex-shrink-0" />

      {/* Message */}
      <Skeleton className="h-4 flex-1" />
    </div>
  )
}

/**
 * Logs list skeleton for diagnostics page
 */
interface LogsListSkeletonProps {
  entries?: number
  className?: string
}

function LogsListSkeleton({ entries = 10, className, ...props }: LogsListSkeletonProps) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {Array.from({ length: entries }).map((_, i) => (
        <LogEntrySkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Recording detail skeleton
 */
function RecordingDetailSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("space-y-6", className)} {...props}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <div className="flex items-center space-x-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Summary section */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <TextSkeleton lines={3} />
      </div>

      {/* Key points */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-28" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-2">
              <Skeleton className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Action items */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-2">
              <Skeleton className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-24" />
        <TextSkeleton lines={8} />
      </div>
    </div>
  )
}

/**
 * Transcription interface skeleton
 */
function TranscriptionSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      {/* Transcript area */}
      <div className="min-h-64 rounded-lg border p-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <TextSkeleton lines={6} />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between text-sm">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

export {
  Skeleton,
  TextSkeleton,
  CardSkeleton,
  ListSkeleton,
  LogEntrySkeleton,
  LogsListSkeleton,
  RecordingDetailSkeleton,
  TranscriptionSkeleton
}
