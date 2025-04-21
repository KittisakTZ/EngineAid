import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ListRenderItemInfo,
  ViewStyle
} from 'react-native';

interface DropdownProps {
  placeholder: string;
  items: string[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  visible: boolean;
  onToggle: () => void;
  style?: ViewStyle;
}

export function Dropdown({
  placeholder,
  items,
  selectedValue,
  onSelect,
  disabled = false,
  visible,
  onToggle,
  style,
}: DropdownProps) {
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          disabled && styles.disabledButton,
        ]}
        onPress={onToggle}
        disabled={disabled}
      >
        <Text
          style={[
            styles.buttonText,
            !selectedValue && styles.placeholderText,
            disabled && styles.disabledText,
          ]}
        >
          {selectedValue || placeholder}
        </Text>
        <Text style={[styles.icon, disabled && styles.disabledText]}>▼</Text>
      </TouchableOpacity>

      {visible && (
        <View style={styles.dropdownList} onStartShouldSetResponder={() => true}>
          <FlatList
            data={items}
            renderItem={({ item }: ListRenderItemInfo<string>) => (
              <TouchableOpacity
                style={styles.item}
                onPress={() => {
                  onSelect(item);
                  onToggle();
                }}
              >
                <Text style={styles.itemText}>{item}</Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item}
            nestedScrollEnabled={true}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 20,
  },
  button: {
    backgroundColor: '#f8f8f8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
  },
  buttonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#888',
  },
  disabledButton: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
  },
  disabledText: {
    color: '#aaa',
  },
  icon: {
    fontSize: 10,
    color: '#777',
    marginLeft: 5,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    marginTop: 2,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    height: 150,
    zIndex: 30,
    overflow: 'hidden',
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemText: {
    fontSize: 14,
    color: '#333',
  },
});