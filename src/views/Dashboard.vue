<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { signOut } from 'firebase/auth'
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc,
} from 'firebase/firestore'
import Chart from 'chart.js/auto'
import { auth, db } from '../firebase'

const router = useRouter()
const uid = auth.currentUser.uid
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other']

const txns = ref([])
const budget = ref(0)
const budgetInput = ref('')
const today = () => new Date().toISOString().slice(0, 10)
const form = ref({ type: 'expense', amount: '', category: 'Food', note: '', date: today() })
const aiInput = ref('')
const aiMsg = ref('')
const insights = ref('')
const loading = ref(false)
const pieEl = ref(null)
const barEl = ref(null)
let unsubTx, unsubUser, pie, bar

onMounted(() => {
  // Realtime listener on this user's transactions only
  const q = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'))
  unsubTx = onSnapshot(q, (snap) => {
    txns.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  })
  unsubUser = onSnapshot(doc(db, 'users', uid), (s) => { budget.value = s.data()?.budget || 0 })
})
onUnmounted(() => { unsubTx?.(); unsubUser?.(); pie?.destroy(); bar?.destroy() })

const income = computed(() => txns.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))
const expense = computed(() => txns.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))
const balance = computed(() => income.value - expense.value)
const monthSpent = computed(() =>
  txns.value.filter(t => t.type === 'expense' && t.date.startsWith(today().slice(0, 7)))
    .reduce((s, t) => s + t.amount, 0))
const pct = computed(() => (budget.value ? Math.min(100, Math.round((monthSpent.value / budget.value) * 100)) : 0))

const byCategory = computed(() => {
  const m = {}
  txns.value.filter(t => t.type === 'expense').forEach(t => { m[t.category] = (m[t.category] || 0) + t.amount })
  return m
})
const byMonth = computed(() => {
  const m = {}
  txns.value.filter(t => t.type === 'expense').forEach(t => {
    const k = t.date.slice(0, 7); m[k] = (m[k] || 0) + t.amount
  })
  return Object.fromEntries(Object.entries(m).sort())
})

function draw() {
  if (!pieEl.value || !barEl.value) return
  pie?.destroy(); bar?.destroy()
  pie = new Chart(pieEl.value, {
    type: 'doughnut',
    data: { labels: Object.keys(byCategory.value), datasets: [{ data: Object.values(byCategory.value) }] },
    options: { plugins: { title: { display: true, text: 'Spending by category' } } },
  })
  bar = new Chart(barEl.value, {
    type: 'bar',
    data: { labels: Object.keys(byMonth.value), datasets: [{ label: 'Spent (₹)', data: Object.values(byMonth.value) }] },
    options: { plugins: { title: { display: true, text: 'Monthly spending' } } },
  })
}
watch(txns, () => nextTick(draw), { deep: true })

async function addTx(t) {
  await addDoc(collection(db, 'users', uid, 'transactions'), { ...t, amount: Number(t.amount) })
}
async function submitForm() {
  if (!form.value.amount) return
  await addTx(form.value)
  form.value.amount = ''; form.value.note = ''
}
const removeTx = (id) => deleteDoc(doc(db, 'users', uid, 'transactions', id))
const saveBudget = () => setDoc(doc(db, 'users', uid), { budget: Number(budgetInput.value) }, { merge: true })

// ---------- AI feature 1: natural-language expense entry ----------
async function aiAdd() {
  aiMsg.value = ''; loading.value = true
  try {
    const r = await fetch(`${API}/api/parse`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: aiInput.value, today: today(), categories }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error)
    await addTx(data)
    aiMsg.value = `Added: ${data.type} ₹${data.amount} (${data.category})`
    aiInput.value = ''
  } catch (e) { aiMsg.value = 'AI failed: ' + e.message }
  loading.value = false
}

// ---------- AI feature 2: monthly insights ----------
async function getInsights() {
  loading.value = true
  try {
    const r = await fetch(`${API}/api/insights`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ byCategory: byCategory.value, income: income.value, expense: expense.value, budget: budget.value }),
    })
    const data = await r.json()
    insights.value = data.insights || data.error
  } catch (e) { insights.value = e.message }
  loading.value = false
}

async function logout() { await signOut(auth); router.push('/login') }
</script>

<template>
  <div class="wrap">
    <header>
      <h1>🌸 Bloom Balance</h1>
      <button class="ghost" @click="logout">Logout</button>
    </header>

    <section class="cards">
      <div class="card"><small>Income</small><h2 class="income">₹{{ income }}</h2></div>
      <div class="card"><small>Expenses</small><h2 class="expense">₹{{ expense }}</h2></div>
      <div class="card"><small>Balance</small><h2>₹{{ balance }}</h2></div>
    </section>

    <section class="card">
      <h3>Monthly budget goal</h3>
      <div class="row">
        <input v-model="budgetInput" type="number" placeholder="Set monthly budget (₹)" />
        <button @click="saveBudget">Save</button>
      </div>
      <template v-if="budget">
        <div class="bar"><div :style="{ width: pct + '%' }" :class="{ over: pct >= 100 }"></div></div>
        <small class="muted">₹{{ monthSpent }} of ₹{{ budget }} spent this month ({{ pct }}%)</small>
      </template>
    </section>

    <section class="card">
      <h3>✨ Quick add with AI</h3>
      <div class="row">
        <input v-model="aiInput" placeholder='e.g. "spent 450 on pizza yesterday"' @keyup.enter="aiAdd" />
        <button :disabled="loading" @click="aiAdd">Add</button>
      </div>
      <p class="muted">{{ aiMsg }}</p>
    </section>

    <section class="card">
      <h3>Add transaction</h3>
      <div class="row">
        <select v-model="form.type"><option>expense</option><option>income</option></select>
        <input v-model="form.amount" type="number" placeholder="Amount" />
        <select v-model="form.category"><option v-for="c in categories" :key="c">{{ c }}</option></select>
        <input v-model="form.note" placeholder="Note" />
        <input v-model="form.date" type="date" />
        <button @click="submitForm">Add</button>
      </div>
    </section>

    <section class="charts">
      <div class="card"><canvas ref="pieEl"></canvas></div>
      <div class="card"><canvas ref="barEl"></canvas></div>
    </section>

    <section class="card">
      <h3>✨ AI insights</h3>
      <button :disabled="loading" @click="getInsights">Analyse my spending</button>
      <p style="white-space: pre-wrap">{{ insights }}</p>
    </section>

    <section class="card">
      <h3>Transactions</h3>
      <div v-for="t in txns" :key="t.id" class="tx">
        <span>{{ t.date }} · {{ t.category }} · {{ t.note }}</span>
        <span>
          <b :class="t.type">{{ t.type === 'income' ? '+' : '-' }}₹{{ t.amount }}</b>
          <button class="del" @click="removeTx(t.id)">x</button>
        </span>
      </div>
      <p v-if="!txns.length" class="muted">No transactions yet.</p>
    </section>
  </div>
</template>
