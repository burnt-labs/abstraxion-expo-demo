import React, { useState, useEffect } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';

interface JSONInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  error?: string;
  showFormatButton?: boolean;
  onFormat?: () => void;
}

export const JSONInput: React.FC<JSONInputProps> = ({
  value,
  onChangeText,
  onValidationChange,
  error: externalError,
  showFormatButton = false,
  onFormat,
  style,
  ...props
}) => {
  const [internalError, setInternalError] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  // Normalize text by replacing smart quotes with regular quotes
  const normalizeText = (text: string): string => {
    return text
      .replace(/[\u201C\u201D]/g, '"')  // Replace smart double quotes
      .replace(/[\u2018\u2019]/g, "'")  // Replace smart single quotes
      .replace(/[\u201E]/g, '"')        // Replace low double quotes
      .replace(/[\u201A]/g, "'");       // Replace low single quotes
  };

  // Handle text changes with automatic normalization
  const handleTextChange = (text: string) => {
    const normalizedText = normalizeText(text);
    onChangeText(normalizedText);
  };

  // Validate JSON
  const validateJSON = (text: string): boolean => {
    if (!text.trim()) {
      setInternalError('');
      return false;
    }

    try {
      JSON.parse(text);
      setInternalError('');
      return true;
    } catch (e) {
      setInternalError('Invalid JSON format');
      return false;
    }
  };

  // Validate on blur
  const handleBlur = () => {
    setIsFocused(false);
    const isValid = validateJSON(value);
    onValidationChange?.(isValid);
  };

  // Clear error when typing
  const handleFocus = () => {
    setIsFocused(true);
    setInternalError('');
  };

  const displayError = externalError || internalError;
  const hasError = !isFocused && !!displayError;

  return (
    <View>
      <TextInput
        {...props}
        style={[
          styles.input,
          hasError && styles.errorInput,
          style,
        ]}
        value={value}
        onChangeText={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {hasError && (
        <Text style={styles.errorText}>{displayError}</Text>
      )}
      {showFormatButton && onFormat && (
        <TouchableOpacity
          style={styles.formatButton}
          onPress={onFormat}
        >
          <Text style={styles.formatButtonText}>Format JSON</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    fontFamily: 'monospace',
    backgroundColor: '#f8f8f8',
    minHeight: 120,
  },
  errorInput: {
    borderColor: '#dc3545',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
  },
  formatButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#007bff',
    borderRadius: 4,
    alignItems: 'center',
  },
  formatButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});