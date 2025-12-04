import { SQLiteProvider } from 'expo-sqlite';
import ExpenseScreen from './ExpenseScreen';

export default function App() {
  return (
    <SQLiteProvider databaseName="expenses_v2.db">
      <ExpenseScreen />
    </SQLiteProvider>
  );
}