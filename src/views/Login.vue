<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

const router = useRouter()
const email = ref('')
const password = ref('')
const isSignup = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  try {
    if (isSignup.value) await createUserWithEmailAndPassword(auth, email.value, password.value)
    else await signInWithEmailAndPassword(auth, email.value, password.value)
    router.push('/dashboard')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="card auth">
    <h2>🌸 Bloom Balance</h2>
    <p class="muted">{{ isSignup ? 'Create an account' : 'Welcome back' }}</p>
    <input v-model="email" type="email" placeholder="Email" />
    <input v-model="password" type="password" placeholder="Password (min 6 chars)" @keyup.enter="submit" />
    <button @click="submit">{{ isSignup ? 'Sign up' : 'Log in' }}</button>
    <p class="err">{{ error }}</p>
    <p class="muted" style="cursor:pointer" @click="isSignup = !isSignup">
      {{ isSignup ? 'Have an account? Log in' : 'New here? Sign up' }}
    </p>
  </div>
</template>
