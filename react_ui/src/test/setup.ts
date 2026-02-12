import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock-preview'
}

if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {}
}
