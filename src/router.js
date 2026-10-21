import { createRouter, createWebHistory } from 'vue-router'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: Login },
  { path: '/dashboard', component: Dashboard, meta: { requiresAuth: true } },
]

const router = createRouter({ history: createWebHistory(), routes })

// Wait for Firebase to restore the session once, then decide.
const getUser = () =>
  new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (u) => { off(); resolve(u) })
  })

// Route guard: protects private pages
router.beforeEach(async (to) => {
  const user = await getUser()
  if (to.meta.requiresAuth && !user) return '/login'
  if (to.path === '/login' && user) return '/dashboard'
})

export default router
