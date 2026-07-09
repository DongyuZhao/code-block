package io.github.dongyuzhao.composecodeblock

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

internal enum class Glyph {
    Clip,
    Done,
    Share,
    More
}

@Composable
internal fun GlyphMark(
    glyph: Glyph,
    modifier: Modifier = Modifier
) {
    val color = LocalContentColor.current
    Canvas(modifier = modifier.size(20.dp)) {
        val strokeWidth = 1.6.dp.toPx()
        val stroke = Stroke(
            width = strokeWidth,
            cap = StrokeCap.Round,
            join = StrokeJoin.Round
        )

        when (glyph) {
            Glyph.Clip -> {
                val side = size.minDimension * 0.5f
                drawRect(
                    color = color,
                    topLeft = Offset(size.width * 0.18f, size.height * 0.18f),
                    size = Size(side, side),
                    style = stroke
                )
                drawRect(
                    color = color,
                    topLeft = Offset(size.width * 0.34f, size.height * 0.34f),
                    size = Size(side, side),
                    style = stroke
                )
            }
            Glyph.Done -> {
                drawLine(
                    color = color,
                    start = Offset(size.width * 0.2f, size.height * 0.52f),
                    end = Offset(size.width * 0.42f, size.height * 0.73f),
                    strokeWidth = strokeWidth,
                    cap = StrokeCap.Round
                )
                drawLine(
                    color = color,
                    start = Offset(size.width * 0.42f, size.height * 0.73f),
                    end = Offset(size.width * 0.82f, size.height * 0.28f),
                    strokeWidth = strokeWidth,
                    cap = StrokeCap.Round
                )
            }
            Glyph.Share -> {
                val left = Offset(size.width * 0.25f, size.height * 0.5f)
                val upper = Offset(size.width * 0.72f, size.height * 0.25f)
                val lower = Offset(size.width * 0.72f, size.height * 0.75f)
                val radius = size.minDimension * 0.09f
                drawLine(color, left, upper, strokeWidth, StrokeCap.Round)
                drawLine(color, left, lower, strokeWidth, StrokeCap.Round)
                drawCircle(color, radius, left)
                drawCircle(color, radius, upper)
                drawCircle(color, radius, lower)
            }
            Glyph.More -> {
                val radius = size.minDimension * 0.08f
                for (part in listOf(0.25f, 0.5f, 0.75f)) {
                    drawCircle(
                        color = color,
                        radius = radius,
                        center = Offset(size.width * part, size.height * 0.5f)
                    )
                }
            }
        }
    }
}
