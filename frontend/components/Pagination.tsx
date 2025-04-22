import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { CustomButton } from './CustomButton';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  style?: ViewStyle;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
  style,
}: PaginationProps) {
  // If there's only one page or less, don't show pagination
  if (totalPages <= 1) return null;

  return (
    <View style={[styles.container, style]}>
      <CustomButton
        title="หน้าแรก"
        variant="primary"
        size="small"
        onPress={() => onPageChange(1)}
        disabled={currentPage === 1 || loading}
        style={styles.button}
      />

      <CustomButton
        title="ก่อนหน้า"
        variant="primary"
        size="small"
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading}
        style={styles.button}
      />

      <Text style={styles.pageInfo}>
        {currentPage} / {totalPages}
      </Text>

      <CustomButton
        title="ถัดไป"
        variant="primary"
        size="small"
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || loading}
        style={styles.button}
      />

      <CustomButton
        title="หน้าสุดท้าย"
        variant="primary" 
        size="small"
        onPress={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages || loading}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 10,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    marginHorizontal: 2,
  },
  pageInfo: {
    marginHorizontal: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
});