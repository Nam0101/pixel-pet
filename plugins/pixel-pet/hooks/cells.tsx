import type { ClientModule } from 'claude-code'

/** One run of cells in one color pair: its text, its foreground, and its background; null is the terminal's own color. */
type Run = [string, string | null, string | null]
/** Rows of runs to draw, as `encodeRuns` and `barRow` make them. */
type Props = { rows: Run[][] }

/**
 * Draws rows of colored text and tells the hooks module what the pointer does over them: `hover` with the column as it
 * changes, `leave`, `click` for a press let go where it went down, and `drag` then `drop` for one that moved. The
 * hooks module, which has `$`, decides what each means.
 */
const Cells: ClientModule<Props, true> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    let downAt: number | undefined
    let isDragged = false
    let hoverAt = -1
    surface.onPointer(e => {
      if (e.type === 'down') {
        downAt = e.x
        isDragged = false
      } else if (e.type === 'move' && downAt !== undefined) {
        isDragged ||= e.x !== downAt
        if (isDragged) {
          surface.post({ type: 'drag', x: e.x, from: downAt })
        }
      } else if (e.type === 'move' && e.x !== hoverAt) {
        hoverAt = e.x
        surface.post({ type: 'hover', x: e.x })
      } else if (e.type === 'up' && downAt !== undefined) {
        surface.post({ type: isDragged ? 'drop' : 'click', x: e.x, from: downAt })
        downAt = undefined
      } else if (e.type === 'leave' && downAt === undefined) {
        hoverAt = -1
        surface.post({ type: 'leave', x: e.x })
      }
    })
    surface.setState(true)
  }

  return (
    <Box flexDirection="column">
      {(props?.rows ?? []).map((row, y) => (
        <Text key={`row-${y}`} wrap="truncate-end">
          {row.map(([text, color, backgroundColor], i) => (
            <Text key={`run-${i}`} color={color ?? undefined} backgroundColor={backgroundColor ?? undefined}>
              {text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}

export default Cells
