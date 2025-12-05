// dashboard home screen:
// REQUIREMENTS:
// 1. title "Business Dashboard" centered at the top
// 2. row of three summary cards
//    - each card shows a label and a numeric value
// 3. use flexbox to center content
// 4. cards should have backgroundColor "#e8f5e9" and padding
// 5. space cards evenly using justifyContent: 'space-between'

import { SQLiteProvider } from 'expo-sqlite';
import ExpenseScreen from './ExpenseScreen';

export default function App() {
  return (
    <SQLiteProvider databaseName="expenses_v2.db">
      <ExpenseScreen />
    </SQLiteProvider>
  );
}