import React from 'react';
import { StyleSheet, TouchableOpacity, Text, ActivityIndicator, View, ViewStyle, TextStyle } from 'react-native';

export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'danger' 
  | 'success' 
  | 'outline' 
  | 'text' 
  | 'info' 
  | 'warning' 
  | 'dark' 
  | 'light';

export type ButtonSize = 'small' | 'medium' | 'large' | 'xlarge';

interface CustomButtonProps {
  onPress: () => void;
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  rounded?: boolean;
  elevated?: boolean;
}

export function CustomButton({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  rounded = false,
  elevated = false,
}: CustomButtonProps) {
  const getButtonStyles = (): ViewStyle => {
    const variantStyles = {
      primary: {
        backgroundColor: '#007AFF',
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: '#6c757d',
        borderWidth: 0,
      },
      danger: {
        backgroundColor: '#FF3B30',
        borderWidth: 0,
      },
      success: {
        backgroundColor: '#4CD964',
        borderWidth: 0,
      },
      info: {
        backgroundColor: '#5AC8FA',
        borderWidth: 0,
      },
      warning: {
        backgroundColor: '#FF9500',
        borderWidth: 0,
      },
      dark: {
        backgroundColor: '#1c1c1e',
        borderWidth: 0,
      },
      light: {
        backgroundColor: '#f8f9fa',
        borderWidth: 0,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#007AFF',
      },
      text: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
    };

    const sizeStyles = {
      small: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: rounded ? 16 : 4,
      },
      medium: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: rounded ? 20 : 6,
      },
      large: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: rounded ? 24 : 8,
      },
      xlarge: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: rounded ? 28 : 10,
      },
    };

    const additionalStyles: ViewStyle = {
      width: fullWidth ? '100%' : undefined,
      opacity: disabled ? 0.7 : 1,
    };

    if (elevated && variant !== 'text' && variant !== 'outline') {
      additionalStyles.shadowColor = '#000';
      additionalStyles.shadowOffset = { width: 0, height: 2 };
      additionalStyles.shadowOpacity = 0.2;
      additionalStyles.shadowRadius = 4;
      additionalStyles.elevation = 2;
    }

    return {
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...additionalStyles,
    };
  };

  const getTextColor = (): string => {
    if (variant === 'outline') return '#007AFF';
    if (variant === 'text') return '#007AFF';
    if (variant === 'light') return '#1c1c1e'; // Dark text for light background
    return '#FFFFFF'; // White text for all other colored backgrounds
  };

  const getTextSize = (): number => {
    switch (size) {
      case 'small':
        return 12;
      case 'medium':
        return 14;
      case 'large':
        return 16;
      case 'xlarge':
        return 18;
      default:
        return 14;
    }
  };

  const buttonStyles = [
    styles.button,
    getButtonStyles(),
    style,
  ];

  const textStyles = [
    styles.text,
    { color: getTextColor(), fontSize: getTextSize() },
    textStyle,
  ];

  const iconSpacing = size === 'small' ? 4 : 8;

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size={size === 'small' ? 'small' : 'small'} />
      ) : (
        <View style={[styles.contentContainer, { gap: iconSpacing }]}>
          {icon && iconPosition === 'left' && icon}
          <Text style={textStyles}>{title}</Text>
          {icon && iconPosition === 'right' && icon}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});