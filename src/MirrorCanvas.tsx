import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import type { MirrorPoint, MirrorStroke } from './store/useMirrorMessageStore';

type MirrorCanvasProps = {
  messageText?: string;
  strokes?: MirrorStroke[];
  editable?: boolean;
  revealProgress?: number;
  onChangeStrokes?: (strokes: MirrorStroke[]) => void;
  onRevealProgressChange?: (progress: number) => void;
  onGestureActiveChange?: (active: boolean) => void;
  prompt?: string;
};

type CanvasSize = {
  width: number;
  height: number;
};

const BRUSH_SIZE = 11;
const INTERPOLATION_STEP = 8;
const MIN_POINT_DISTANCE = 3;
const MAX_STROKES = 20;
const MAX_POINTS_PER_STROKE = 300;

function clampPoint(point: MirrorPoint, size: CanvasSize) {
  return {
    x: Math.max(BRUSH_SIZE / 2, Math.min(size.width - BRUSH_SIZE / 2, point.x)),
    y: Math.max(BRUSH_SIZE / 2, Math.min(size.height - BRUSH_SIZE / 2, point.y)),
  };
}

function interpolatePoints(from: MirrorPoint, to: MirrorPoint) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.floor(distance / INTERPOLATION_STEP));

  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };
  });
}

function getPointDistance(from: MirrorPoint, to: MirrorPoint) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function trimStroke(stroke: MirrorStroke) {
  if (stroke.length <= MAX_POINTS_PER_STROKE) {
    return stroke;
  }

  const step = Math.ceil(stroke.length / MAX_POINTS_PER_STROKE);
  const sampled = stroke.filter((_, index) => index % step === 0);
  const lastPoint = stroke[stroke.length - 1];
  const sampledLastPoint = sampled[sampled.length - 1];

  if (sampledLastPoint !== lastPoint) {
    sampled.push(lastPoint);
  }

  return sampled.slice(-MAX_POINTS_PER_STROKE);
}

function trimStrokes(nextStrokes: MirrorStroke[]) {
  return nextStrokes.slice(-MAX_STROKES).map(trimStroke);
}

export default function MirrorCanvas({
  messageText,
  strokes = [],
  editable = false,
  revealProgress = 0,
  onChangeStrokes,
  onRevealProgressChange,
  onGestureActiveChange,
  prompt,
}: MirrorCanvasProps) {
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 1, height: 1 });
  const gestureStartProgressRef = useRef(0);
  const strokesRef = useRef(strokes);
  const gestureActiveRef = useRef(false);

  useEffect(() => {
    if (!gestureActiveRef.current) {
      strokesRef.current = strokes;
    }
  }, [strokes]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editable || !!onRevealProgressChange,
        onStartShouldSetPanResponderCapture: () => editable || !!onRevealProgressChange,
        onMoveShouldSetPanResponder: () => editable || !!onRevealProgressChange,
        onMoveShouldSetPanResponderCapture: () => editable || !!onRevealProgressChange,
        onPanResponderGrant: event => {
          gestureActiveRef.current = true;
          onGestureActiveChange?.(true);

          if (editable && onChangeStrokes) {
            const point = clampPoint(
              {
                x: event.nativeEvent.locationX,
                y: event.nativeEvent.locationY,
              },
              canvasSize,
            );
            const nextStrokes = trimStrokes([...strokesRef.current, [point]]);
            strokesRef.current = nextStrokes;
            onChangeStrokes(nextStrokes);
          }

          gestureStartProgressRef.current = revealProgress;
        },
        onPanResponderMove: (event, gestureState) => {
          if (editable && onChangeStrokes) {
            const point = clampPoint(
              {
                x: event.nativeEvent.locationX,
                y: event.nativeEvent.locationY,
              },
              canvasSize,
            );
            const nextStrokes = strokesRef.current.map(stroke => [...stroke]);
            const currentStroke = nextStrokes[nextStrokes.length - 1];

            if (!currentStroke) {
              const nextStrokeSet = [[point]];
              strokesRef.current = nextStrokeSet;
              onChangeStrokes(nextStrokeSet);
              return;
            }

            const lastPoint = currentStroke[currentStroke.length - 1];
            const nextPoints = interpolatePoints(lastPoint, point).filter(nextPoint =>
              getPointDistance(currentStroke[currentStroke.length - 1], nextPoint) >= MIN_POINT_DISTANCE,
            );

            if (nextPoints.length === 0) {
              return;
            }

            nextStrokes[nextStrokes.length - 1] = trimStroke([...currentStroke, ...nextPoints]);
            const nextStrokeSet = trimStrokes(nextStrokes);
            strokesRef.current = nextStrokeSet;
            onChangeStrokes(nextStrokeSet);
            return;
          }

          if (onRevealProgressChange) {
            const gestureDistance = Math.abs(gestureState.dx) + Math.abs(gestureState.dy) * 0.35;
            const nextProgress = Math.min(1, gestureStartProgressRef.current + gestureDistance / 240);
            onRevealProgressChange(nextProgress);
          }
        },
        onPanResponderRelease: () => {
          gestureActiveRef.current = false;
          onGestureActiveChange?.(false);
        },
        onPanResponderTerminate: () => {
          gestureActiveRef.current = false;
          onGestureActiveChange?.(false);
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [canvasSize, editable, onChangeStrokes, onGestureActiveChange, onRevealProgressChange, revealProgress],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  };

  const fogOpacity = editable ? 0.38 : 0.78 - revealProgress * 0.62;
  const messageOpacity = editable ? 0.9 : Math.max(0.18, revealProgress);

  return (
    <View style={styles.shell}>
      <View style={styles.canvas} onLayout={handleLayout} {...panResponder.panHandlers}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
        <View style={styles.messageWrap}>
          {!!messageText && (
            <Text variant="headlineMedium" style={[styles.message, { opacity: messageOpacity }]}>
              {messageText}
            </Text>
          )}
        </View>
        <View style={[styles.fogLayer, { opacity: fogOpacity }]} />
        {!!prompt && <Text style={styles.prompt}>{prompt}</Text>}
        <View style={styles.strokeLayer} pointerEvents="none">
          {strokes.flatMap((stroke, strokeIndex) =>
            stroke.map((point, pointIndex) => (
              <View
                key={`${strokeIndex}-${pointIndex}`}
                style={[
                  styles.brush,
                  {
                    left: point.x - BRUSH_SIZE / 2,
                    top: point.y - BRUSH_SIZE / 2,
                  },
                ]}
              />
            )),
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
  },
  canvas: {
    height: 280,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#8E6768',
    borderWidth: 1,
    borderColor: 'rgba(255, 243, 234, 0.35)',
  },
  glowTop: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: 50,
    height: 140,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 243, 234, 0.22)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -40,
    right: -10,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: 'rgba(178, 91, 99, 0.24)',
  },
  messageWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 26,
    paddingVertical: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    color: '#2A161F',
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 40,
  },
  prompt: {
    position: 'absolute',
    bottom: 18,
    left: 20,
    right: 20,
    color: '#FFF3EA',
    textAlign: 'center',
    opacity: 0.92,
    lineHeight: 20,
  },
  fogLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#F2DDD3',
  },
  strokeLayer: {
    ...StyleSheet.absoluteFill,
  },
  brush: {
    position: 'absolute',
    width: BRUSH_SIZE,
    height: BRUSH_SIZE,
    borderRadius: 999,
    backgroundColor: 'rgba(43, 25, 31, 0.86)',
  },
});
