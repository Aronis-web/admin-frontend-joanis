import React from 'react';
import { View } from 'react-native';

type PixelSpriteProps = {
  frame: number[][];
  palette: string[];
  scale?: number;     // tamaño de cada pixel en dp
  flipX?: boolean;
};

export default function PixelSprite({
  frame,
  palette,
  scale = 4,
  flipX = false,
}: PixelSpriteProps) {
  const rows = frame.length;
  const cols = frame[0]?.length ?? 0;
  const w = cols * scale;
  const h = rows * scale;

  return (
    <View
      style={{
        width: w,
        height: h,
        flexDirection: 'row',
        transform: [{ scaleX: flipX ? -1 : 1 }],
      }}
    >
      {frame.map((row, y) => (
        <View key={y} style={{ flexDirection: 'column' }}>
          {row.map((idx, x) => {
            if (idx <= 0) {
              // 0 = transparente
              return (
                <View
                  key={`${x}-${y}`}
                  style={{
                    width: scale,
                    height: scale,
                  }}
                />
              );
            }
            const fill = palette[idx] || '#000';
            return (
              <View
                key={`${x}-${y}`}
                style={{
                  width: scale,
                  height: scale,
                  backgroundColor: fill,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}