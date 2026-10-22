import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, typography} from '../../constants/theme';

/**
 * Consciousness Ring Component
 * Web-compatible circular progress indicator (no SVG dependency)
 */
const ConsciousnessRing = ({
  level = 'PHYSICAL',
  currentXP = 0,
  requiredXP = 5000,
  size = 120,
}) => {
  const progress = Math.min(currentXP / requiredXP, 1);

  const levelColors = {
    PHYSICAL: colors.consciousness?.physical || '#3b82f6',
    MENTAL: colors.consciousness?.mental || '#8b5cf6',
    SPIRITUAL: colors.consciousness?.spiritual || '#ec4899',
    COSMIC: colors.consciousness?.cosmic || '#f59e0b',
    ON_THE_STAR: colors.consciousness?.onTheStar || '#eab308',
  };

  const color = levelColors[level] || levelColors.PHYSICAL;
  const pct = Math.round(progress * 100);

  return (
    <View style={[styles.container, {width: size, height: size}]}>
      {/* Outer ring (background) */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: 'rgba(255,255,255,0.1)',
          },
        ]}
      />
      {/* Progress arc (simulated with borderColor) */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            borderTopColor: progress > 0.25 ? color : 'transparent',
            borderRightColor: progress > 0.5 ? color : 'transparent',
            borderBottomColor: progress > 0.75 ? color : 'transparent',
            borderLeftColor: progress > 0 ? color : 'transparent',
            opacity: 0.9,
          },
        ]}
      />
      {/* Center content */}
      <View style={styles.center}>
        <Text style={[styles.percentage, {color}]}>{pct}%</Text>
        <Text style={styles.label}>{level}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 6,
  },
  center: {
    alignItems: 'center',
  },
  percentage: {
    ...typography.h2,
    fontWeight: 'bold',
  },
  label: {
    ...typography.caption,
    marginTop: 4,
  },
});

export default ConsciousnessRing;
