// components/ButtonShowcase.tsx
import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomButton } from './CustomButton';

export function ButtonShowcase() {
  // Sample icons for demonstration
  const homeIcon = <Ionicons name="home" size={18} color="#FFFFFF" />;
  const settingsIcon = <Ionicons name="settings" size={18} color="#FFFFFF" />;
  const saveIcon = <Ionicons name="save" size={18} color="#FFFFFF" />;
  
  // Icons for outline and text variants (need different color)
  const outlineIcon = <Ionicons name="bookmark" size={18} color="#007AFF" />;
  const textIcon = <Ionicons name="arrow-forward" size={18} color="#007AFF" />;
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Button Variants</Text>
      <View style={styles.row}>
        <CustomButton 
          title="Primary" 
          variant="primary" 
          onPress={() => console.log('Primary pressed')} 
        />
        <CustomButton 
          title="Secondary" 
          variant="secondary" 
          onPress={() => console.log('Secondary pressed')} 
        />
        <CustomButton 
          title="Success" 
          variant="success" 
          onPress={() => console.log('Success pressed')} 
        />
      </View>
      
      <View style={styles.row}>
        <CustomButton 
          title="Danger" 
          variant="danger" 
          onPress={() => console.log('Danger pressed')} 
        />
        <CustomButton 
          title="Info" 
          variant="info" 
          onPress={() => console.log('Info pressed')} 
        />
        <CustomButton 
          title="Warning" 
          variant="warning" 
          onPress={() => console.log('Warning pressed')} 
        />
      </View>
      
      <View style={styles.row}>
        <CustomButton 
          title="Dark" 
          variant="dark" 
          onPress={() => console.log('Dark pressed')} 
        />
        <CustomButton 
          title="Light" 
          variant="light" 
          onPress={() => console.log('Light pressed')} 
        />
        <CustomButton 
          title="Outline" 
          variant="outline" 
          onPress={() => console.log('Outline pressed')} 
        />
      </View>
      
      <View style={styles.row}>
        <CustomButton 
          title="Text Button" 
          variant="text" 
          onPress={() => console.log('Text pressed')} 
        />
      </View>
      
      <Text style={styles.sectionTitle}>Button Sizes</Text>
      <View style={styles.column}>
        <CustomButton 
          title="Small Button" 
          size="small" 
          onPress={() => console.log('Small pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Medium Button" 
          size="medium" 
          onPress={() => console.log('Medium pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Large Button" 
          size="large" 
          onPress={() => console.log('Large pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="XLarge Button" 
          size="xlarge" 
          onPress={() => console.log('XLarge pressed')} 
          style={styles.marginBottom}
        />
      </View>
      
      <Text style={styles.sectionTitle}>With Icons</Text>
      <View style={styles.column}>
        <CustomButton 
          title="Home" 
          icon={homeIcon}
          iconPosition="left"
          onPress={() => console.log('Home pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Settings" 
          icon={settingsIcon}
          iconPosition="right"
          variant="secondary"
          onPress={() => console.log('Settings pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Save" 
          icon={saveIcon}
          iconPosition="left"
          variant="success"
          onPress={() => console.log('Save pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Bookmark" 
          icon={outlineIcon}
          iconPosition="left"
          variant="outline"
          onPress={() => console.log('Bookmark pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Continue" 
          icon={textIcon}
          iconPosition="right"
          variant="text"
          onPress={() => console.log('Continue pressed')} 
          style={styles.marginBottom}
        />
      </View>
      
      <Text style={styles.sectionTitle}>Special Styles</Text>
      <View style={styles.column}>
        <CustomButton 
          title="Full Width Button" 
          fullWidth
          onPress={() => console.log('Full width pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Rounded Button" 
          rounded
          variant="info"
          onPress={() => console.log('Rounded pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Elevated Button" 
          elevated
          variant="warning"
          onPress={() => console.log('Elevated pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Rounded Full Width" 
          rounded
          fullWidth
          variant="success"
          onPress={() => console.log('Rounded full width pressed')} 
          style={styles.marginBottom}
        />
      </View>
      
      <Text style={styles.sectionTitle}>States</Text>
      <View style={styles.column}>
        <CustomButton 
          title="Disabled Button" 
          disabled
          onPress={() => console.log('Disabled pressed')} 
          style={styles.marginBottom}
        />
        <CustomButton 
          title="Loading Button" 
          loading
          onPress={() => console.log('Loading pressed')} 
          style={styles.marginBottom}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  column: {
    flexDirection: 'column',
    marginBottom: 10,
  },
  marginBottom: {
    marginBottom: 10,
  }
});