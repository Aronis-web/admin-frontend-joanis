import React from 'react';
import { View } from 'react-native';
import Player from '@/pixel/Player';

export function LoginFooterCharacter() {
  return (
    <View style={{ alignItems: 'center', paddingBottom: 12 }}>
      <Player anim="idle" scale={4} />
    </View>
  );
}