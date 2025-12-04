import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { PieChart } from 'react-native-chart-kit';

const FILTER_ALL = 'ALL';
const FILTER_WEEK = 'WEEK';
const FILTER_MONTH = 'MONTH';

function getFilterLabel(filter) {
  switch (filter) {
    case FILTER_WEEK: return 'This Week';
    case FILTER_MONTH: return 'This Month';
    default: return 'All Time';
  }
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(d); start.setDate(d.getDate() - diffToMonday); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 7); end.setHours(0,0,0,0);
  return { start, end };
}

function getMonthBounds(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1); start.setHours(0,0,0,0);
  const end = new Date(year, month + 1, 1); end.setHours(0,0,0,0);
  return { start, end };
}

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [filter, setFilter] = useState(FILTER_ALL);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  const [editingExpense, setEditingExpense] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT NOT NULL
        );
      `);
      loadExpenses();
    }
    setup();
  }, [db]);

  const loadExpenses = async () => {
    const rows = await db.getAllAsync('SELECT * FROM expenses ORDER BY date DESC, id DESC;');
    setExpenses(rows);
  };

  const addExpense = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !category.trim()) return;
    await db.runAsync(
      'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
      [amt, category.trim(), note.trim() || null, getTodayIsoDate()]
    );
    setAmount(''); setCategory(''); setNote('');
    loadExpenses();
  };

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    if (filter === FILTER_ALL) return expenses;

    const now = new Date();
    let start, end;
    if (filter === FILTER_WEEK) ({ start, end } = getWeekBounds(now));
    if (filter === FILTER_MONTH) ({ start, end } = getMonthBounds(now));

    return expenses.filter(exp => {
      const d = new Date(exp.date);
      return d >= start && d < end;
    });
  }, [expenses, filter]);

  const totalsByCategory = useMemo(() => {
    const map = {};
    for (const exp of filteredExpenses) {
      const cat = exp.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + Number(exp.amount || 0);
    }
    return map;
  }, [filteredExpenses]);

  const overallTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  }, [filteredExpenses]);

  const chartData = Object.entries(totalsByCategory).length > 0
    ? Object.entries(totalsByCategory).map(([cat, total], idx) => ({
        name: cat,
        population: total,
        color: ['#f87171','#60a5fa','#fbbf24','#34d399','#a78bfa','#f472b6'][idx % 6],
        legendFontColor: '#f9fafb',
        legendFontSize: 12,
      }))
    : [
        {
          name: 'No Data',
          population: 1,
          color: '#374151',
          legendFontColor: '#9ca3af',
          legendFontSize: 12,
        },
      ];

  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        <Text style={styles.expenseDate}>{item.date}</Text>
      </View>
      <View style={styles.rowButtons}>
        <TouchableOpacity onPress={() => startEditing(item)}><Text style={styles.edit}>Edit</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => deleteExpense(item.id)}><Text style={styles.delete}>✕</Text></TouchableOpacity>
      </View>
    </View>
  );

  const startEditing = exp => {
    setEditingExpense(exp);
    setEditAmount(String(exp.amount));
    setEditCategory(exp.category);
    setEditNote(exp.note || '');
    setEditDate(exp.date || getTodayIsoDate());
  };

  const cancelEdit = () => {
    setEditingExpense(null);
    setEditAmount(''); setEditCategory(''); setEditNote(''); setEditDate('');
  };

  const saveEdit = async () => {
    if (!editingExpense) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0 || !editCategory.trim() || !editDate.trim()) return;
    await db.runAsync(
      'UPDATE expenses SET amount=?, category=?, note=?, date=? WHERE id=?;',
      [amt, editCategory.trim(), editNote.trim() || null, editDate.trim(), editingExpense.id]
    );
    cancelEdit(); loadExpenses();
  };

  const deleteExpense = async id => {
    await db.runAsync('DELETE FROM expenses WHERE id=?;', [id]);
    loadExpenses();
  };

  const renderListHeader = () => (
    <>
      <Text style={styles.heading}>Advanced Student Expense Tracker</Text>

      {/* Filter */}
      <View style={styles.filterRow}>
        {[FILTER_ALL, FILTER_WEEK, FILTER_MONTH].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter===f && styles.filterButtonActive]}
            onPress={()=>setFilter(f)}
          >
            <Text style={[styles.filterButtonText, filter===f && styles.filterButtonTextActive]}>
              {getFilterLabel(f)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Spending ({getFilterLabel(filter)})</Text>
        <Text style={styles.summaryAmount}>${overallTotal.toFixed(2)}</Text>
      </View>

      {/* Pie Chart */}
      <PieChart
        data={chartData}
        width={Dimensions.get('window').width - 32}
        height={220}
        chartConfig={{
          backgroundColor:'#1f2937',
          backgroundGradientFrom:'#1f2937',
          backgroundGradientTo:'#1f2937',
          color:(opacity=1)=>`rgba(251,191,36,${opacity})`,
          labelColor:(opacity=1)=>`rgba(229,231,235,${opacity})`,
        }}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
      />
     

      {/* Add Expense Form */}
      <View style={styles.form}>
        <Text style={styles.formTitle}>Add New Expense</Text>
        <TextInput style={styles.input} 
        placeholder="Amount" 
        keyboardType="numeric" 
        placeholderTextColor="#9ca3af" 
        value={amount} 
        onChangeText={setAmount}/>
        <TextInput style={styles.input} 
        placeholder="Category" 
        placeholderTextColor="#9ca3af" 
        value={category} 
        onChangeText={setCategory}/>
        <TextInput style={styles.input} 
        placeholder="Note" 
        placeholderTextColor="#9ca3af" 
        value={note} 
        onChangeText={setNote}/>
        <Button title="Add Expense" onPress={addExpense}/>
      </View>

      {/* Edit Panel */}
      {editingExpense && (
        <View style={styles.editPanel}>
          <Text style={styles.editTitle}>Edit Expense</Text>
          <TextInput style={styles.input} 
          placeholder="Amount" 
          keyboardType="numeric" 
          placeholderTextColor="#9ca3af" 
          value={editAmount} 
          onChangeText={setEditAmount}/>
          <TextInput style={styles.input} 
          placeholder="Category" 
          placeholderTextColor="#9ca3af" 
          value={editCategory} 
          onChangeText={setEditCategory}/>
          <TextInput style={styles.input} 
          placeholder="Note" 
          placeholderTextColor="#9ca3af" 
          value={editNote} 
          onChangeText={setEditNote}/>
          <TextInput style={styles.input} 
          placeholder="Date (YYYY-MM-DD)" 
          placeholderTextColor="#9ca3af" 
          value={editDate} 
          onChangeText={setEditDate}/>
          <View style={styles.editButtonsRow}>
            <Button title="Save" onPress={saveEdit}/>
            <Button title="Cancel" color="#6b7280" onPress={cancelEdit}/>
          </View>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredExpenses}
        keyExtractor={item=>item.id.toString()}
        renderItem={renderExpense}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },

  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 12,
  },

  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  filterButtonText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#111827',
    fontWeight: '700',
  },

  summaryCard: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  summaryTitle: {
    color: '#d1d5db',
    fontSize: 14,
    marginBottom: 4,
  },
  summaryAmount: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '700',
  },
  categoryRow: {
    color: '#e5e7eb',
    fontSize: 13,
  },

  form: {
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
  },
  formTitle: {
    color: '#e5e7eb',
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    padding: 8,
    backgroundColor: '#111827',
    color: '#f9fafb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 14,
  },

  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  expenseDate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  rowButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 8,
  },
  edit: {
    color: '#60a5fa',
    fontSize: 13,
    marginRight: 4,
  },
  delete: {
    color: '#f87171',
    fontSize: 18,
  },

  empty: {
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
  },

  editPanel: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4b5563',
    marginTop: 8,
  },
  editTitle: {
    color: '#f9fafb',
    fontWeight: '600',
    marginBottom: 4,
  },
  editButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});