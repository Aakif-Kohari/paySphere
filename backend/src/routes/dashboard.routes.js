const express = require('express')
const router = express.Router()

const dashboardLayouts = new Map()

function getUserId(req) {
  return req.user?.id || 'anonymous'
}

router.get('/layout', (req, res) => {
  const userId = getUserId(req)
  const order = dashboardLayouts.get(userId) || []
  res.json({ order })
})

router.post('/layout', (req, res) => {
  const userId = getUserId(req)
  const { order } = req.body

  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' })
  }

  dashboardLayouts.set(userId, order)
  res.json({ success: true })
})

module.exports = router