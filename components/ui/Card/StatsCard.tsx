import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

interface StatsCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  onPress?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  unit,
  trend,
  onPress,
}) => {
  const theme = useTheme();

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return theme.colors.error;
      case 'down':
        return theme.colors.primary;
      default:
        return theme.colors.secondary;
    }
  };

  return (
    <Card
      style={styles.card}
      onPress={onPress}
      mode="elevated"
    >
      <Card.Content style={styles.content}>
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
        <View style={styles.valueContainer}>
          <Text variant="headlineMedium" style={styles.value}>
            {value}
          </Text>
          {unit && (
            <Text variant="bodyMedium" style={styles.unit}>
              {unit}
            </Text>
          )}
        </View>
        {trend && (
          <View style={[styles.trendContainer, { backgroundColor: getTrendColor() }]}>
            <Text style={styles.trendText}>
              {trend.toUpperCase()}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 8,
    borderRadius: 12,
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 8,
    opacity: 0.8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  value: {
    fontWeight: 'bold',
  },
  unit: {
    marginLeft: 4,
    opacity: 0.7,
  },
  trendContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  trendText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
}); 