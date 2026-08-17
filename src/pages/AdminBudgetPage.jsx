import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const chartColors = [
  '#2d4726',
  '#50693d',
  '#6a4a1c',
  '#8b6f47',
  '#a77c20',
  '#c7d3a6',
  '#d7c8a7',
  '#e8dcc3',
  '#4e3d2a',
  '#24351f',
]

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

function formatCurrency(value) {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function cloneCategories(items) {
  return items.map((item) => ({ ...item }))
}

function cloneTransactions(items) {
  return items.map((item) => ({ ...item }))
}

function createCategory(parentId = null) {
  return {
    id: crypto.randomUUID(),
    name: '',
    budgeted_amount: 0,
    parent_id: parentId,
    sort_order: 0,
    isNew: true,
  }
}

function createTransaction(categoryId = '') {
  return {
    id: crypto.randomUUID(),
    category_id: categoryId,
    amount: 0,
    description: '',
    transaction_date: new Date().toISOString().slice(0, 10),
    isNew: true,
  }
}

function buildCategoryTree(categories) {
  const sorted = [...categories].sort(
    (left, right) =>
      (left.sort_order || 0) - (right.sort_order || 0) ||
      left.name.localeCompare(right.name, 'hu'),
  )

  return sorted
    .filter((category) => !category.parent_id)
    .map((category) => ({
      ...category,
      children: sorted.filter((child) => child.parent_id === category.id),
    }))
}

function getHierarchicalCategoryRows(categories) {
  const tree = buildCategoryTree(categories)
  const includedIds = new Set()

  const rows = tree.flatMap((parent) => {
    includedIds.add(parent.id)

    const childRows = parent.children.map((child) => {
      includedIds.add(child.id)
      return { category: child, isSubcategory: true }
    })

    return [{ category: parent, isSubcategory: false }, ...childRows]
  })

  const orphanRows = categories
    .filter((category) => !includedIds.has(category.id))
    .map((category) => ({ category, isSubcategory: Boolean(category.parent_id) }))

  return [...rows, ...orphanRows]
}

function getLeafCategories(categories) {
  const parentsWithChildren = new Set(
    categories.filter((category) => category.parent_id).map((category) => category.parent_id),
  )

  return categories.filter(
    (category) => !parentsWithChildren.has(category.id) || category.parent_id,
  )
}

function getCategoryLabel(categoryId, categories) {
  const category = categories.find((item) => item.id === categoryId)
  if (!category) {
    return 'Ismeretlen kategória'
  }

  if (category.parent_id) {
    const parent = categories.find((item) => item.id === category.parent_id)
    return parent ? `${parent.name} / ${category.name}` : category.name
  }

  return category.name
}

function getSortedLeafCategories(categories) {
  return getLeafCategories(categories).sort((left, right) =>
    getCategoryLabel(left.id, categories).localeCompare(
      getCategoryLabel(right.id, categories),
      'hu',
    ),
  )
}

/** Fő kategória → alkategóriák id-i; levél → saját id */
function getFilterCategoryIdsForCategory(categoryId, categories) {
  const children = categories
    .filter((category) => category.parent_id === categoryId)
    .map((category) => category.id)

  return children.length > 0 ? children : [categoryId]
}

function getCategoryTotals(category, categories, transactions) {
  const children = categories.filter((item) => item.parent_id === category.id)

  if (children.length > 0) {
    const childTotals = children.map((child) => getCategoryTotals(child, categories, transactions))
    return {
      budget: childTotals.reduce((sum, item) => sum + item.budget, 0),
      actual: childTotals.reduce((sum, item) => sum + item.actual, 0),
    }
  }

  const budget = Number(category.budgeted_amount) || 0
  const actual = transactions
    .filter((transaction) => transaction.category_id === category.id)
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

  return { budget, actual }
}

function DonutChart({ segments }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  if (!total) {
    return (
      <div className="budget-donut budget-donut-empty" aria-hidden="true">
        <span>Nincs adat</span>
      </div>
    )
  }

  let gradientStops = []
  let currentPercent = 0

  segments.forEach((segment) => {
    const percent = (segment.value / total) * 100
    gradientStops.push(`${segment.color} ${currentPercent}% ${currentPercent + percent}%`)
    currentPercent += percent
  })

  return (
    <div
      className="budget-donut"
      style={{ background: `conic-gradient(${gradientStops.join(', ')})` }}
      aria-hidden="true"
    >
      <div className="budget-donut-hole">
        <strong>{formatCurrency(total)}</strong>
        <span>összes kiadás</span>
      </div>
    </div>
  )
}

function BarChart({ rows }) {
  const maxValue = Math.max(...rows.flatMap((row) => [row.budget, row.actual]), 1)

  return (
    <div className="budget-bar-chart" aria-hidden="true">
      {rows.map((row) => (
        <div className="budget-bar-group" key={row.id}>
          <div className="budget-bar-pair">
            <div
              className="budget-bar budget-bar-planned"
              style={{ height: `${(row.budget / maxValue) * 100}%` }}
              title={`Tervezett: ${formatCurrency(row.budget)}`}
            />
            <div
              className="budget-bar budget-bar-actual"
              style={{ height: `${(row.actual / maxValue) * 100}%` }}
              title={`Tényleges: ${formatCurrency(row.actual)}`}
            />
          </div>
          <span>{row.name}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminBudgetPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('summary')
  const [categories, setCategories] = useState([])
  const [savedCategories, setSavedCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [savedTransactions, setSavedTransactions] = useState([])
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(new Set())
  const [isEditingCategories, setIsEditingCategories] = useState(false)
  const [isEditingTransactions, setIsEditingTransactions] = useState(false)
  const [appliedCategoryFilter, setAppliedCategoryFilter] = useState([])
  const [draftCategoryFilter, setDraftCategoryFilter] = useState([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newTransaction, setNewTransaction] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    async function loadBudgetData() {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        navigate('/login')
        return
      }

      if (!isAdmin(user)) {
        setStatusMessage('Ehhez az oldalhoz admin jogosultság szükséges.')
        setIsLoading(false)
        return
      }

      setHasAccess(true)

      const [categoryResult, transactionResult] = await Promise.all([
        supabase.from('budget_categories').select('*').order('sort_order').order('name'),
        supabase
          .from('budget_transactions')
          .select('*')
          .order('transaction_date', { ascending: false }),
      ])

      if (categoryResult.error) {
        setStatusMessage(`Nem sikerült betölteni a kategóriákat: ${categoryResult.error.message}`)
      } else {
        const loadedCategories = categoryResult.data || []
        setCategories(loadedCategories)
        setSavedCategories(cloneCategories(loadedCategories))
        setExpandedCategoryIds(new Set())
      }

      if (transactionResult.error) {
        setStatusMessage(`Nem sikerült betölteni a tranzakciókat: ${transactionResult.error.message}`)
      } else {
        const loadedTransactions = transactionResult.data || []
        setTransactions(loadedTransactions)
        setSavedTransactions(cloneTransactions(loadedTransactions))
      }

      setIsLoading(false)
    }

    loadBudgetData()
  }, [navigate])

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories])
  const leafCategories = useMemo(() => getSortedLeafCategories(categories), [categories])

  const summaryRows = useMemo(
    () =>
      categoryTree.map((category) => {
        const totals = getCategoryTotals(category, categories, transactions)
        return {
          ...category,
          budget: totals.budget,
          actual: totals.actual,
          difference: totals.budget - totals.actual,
        }
      }),
    [categoryTree, categories, transactions],
  )

  const totals = useMemo(() => {
    const budget = summaryRows.reduce((sum, row) => sum + row.budget, 0)
    const actual = summaryRows.reduce((sum, row) => sum + row.actual, 0)

    return {
      budget,
      actual,
      difference: budget - actual,
      spentPercent: budget > 0 ? Math.min(100, Math.round((actual / budget) * 100)) : 0,
    }
  }, [summaryRows])

  const donutSegments = useMemo(
    () =>
      summaryRows
        .filter((row) => row.actual > 0)
        .map((row, index) => ({
          label: row.name,
          value: row.actual,
          color: chartColors[index % chartColors.length],
        })),
    [summaryRows],
  )

  const filteredTransactions = useMemo(() => {
    if (appliedCategoryFilter.length === 0) {
      return transactions
    }

    const allowed = new Set(appliedCategoryFilter)
    return transactions.filter((transaction) => allowed.has(transaction.category_id))
  }, [transactions, appliedCategoryFilter])

  function openCategoryFilter() {
    setDraftCategoryFilter([...appliedCategoryFilter])
    setIsFilterOpen(true)
  }

  function toggleDraftFilterCategory(categoryId) {
    setDraftCategoryFilter((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    )
  }

  function applyCategoryFilter() {
    setAppliedCategoryFilter([...draftCategoryFilter])
    setIsFilterOpen(false)
  }

  function clearCategoryFilter() {
    setAppliedCategoryFilter([])
    setDraftCategoryFilter([])
    setIsFilterOpen(false)
  }

  function openTransactionsForCategory(categoryId) {
    const filterIds = getFilterCategoryIdsForCategory(categoryId, categories)
    setAppliedCategoryFilter(filterIds)
    setDraftCategoryFilter(filterIds)
    setIsFilterOpen(false)
    setViewMode('transactions')
    setStatusMessage('')
  }

  function openAddTransactionModal() {
    const defaultCategoryId =
      appliedCategoryFilter[0] || leafCategories[0]?.id || ''
    setNewTransaction(createTransaction(defaultCategoryId))
    setIsAddModalOpen(true)
    setStatusMessage('')
  }

  function closeAddTransactionModal() {
    setIsAddModalOpen(false)
    setNewTransaction(null)
  }

  function updateNewTransactionField(field, value) {
    setNewTransaction((current) => (current ? { ...current, [field]: value } : current))
  }

  async function saveNewTransaction() {
    if (!newTransaction) {
      return
    }

    if (!newTransaction.category_id || !newTransaction.description.trim()) {
      setStatusMessage('Az új tranzakcióhoz kell kategória és leírás.')
      return
    }

    setIsSubmitting(true)
    setStatusMessage('')

    const row = {
      id: newTransaction.id,
      category_id: newTransaction.category_id,
      amount: Number(newTransaction.amount) || 0,
      description: newTransaction.description.trim(),
      transaction_date: newTransaction.transaction_date,
    }

    const { data, error } = await supabase
      .from('budget_transactions')
      .insert(row)
      .select('*')
      .single()

    setIsSubmitting(false)

    if (error) {
      setStatusMessage(`Nem sikerült menteni a tranzakciót: ${error.message}`)
      return
    }

    const nextTransactions = [data, ...transactions]
    setTransactions(nextTransactions)
    setSavedTransactions(cloneTransactions(nextTransactions))
    closeAddTransactionModal()
    setViewMode('transactions')
    setStatusMessage('Az új tranzakció mentve.')
  }

  function toggleCategory(categoryId) {
    setExpandedCategoryIds((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  function updateCategory(categoryId, field, value) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, [field]: value } : category,
      ),
    )
  }

  function addCategory(parentId = null) {
    setCategories((current) => [...current, createCategory(parentId)])
    if (parentId) {
      setExpandedCategoryIds((current) => new Set([...current, parentId]))
    }
  }

  function removeCategory(categoryId) {
    setCategories((current) => {
      const idsToRemove = new Set()

      function collectIds(id) {
        idsToRemove.add(id)
        current
          .filter((category) => category.parent_id === id)
          .forEach((category) => collectIds(category.id))
      }

      collectIds(categoryId)
      return current.filter((category) => !idsToRemove.has(category.id))
    })
  }

  function startCategoryEditing() {
    setSavedCategories(cloneCategories(categories))
    setStatusMessage('')
    setIsEditingCategories(true)
  }

  function discardCategoryChanges() {
    setCategories(cloneCategories(savedCategories))
    setIsEditingCategories(false)
    setStatusMessage('')
    setViewMode('summary')
  }

  async function saveCategoryChanges() {
    setIsSubmitting(true)
    setStatusMessage('')

    const invalidCategory = categories.find((category) => !category.name.trim())
    if (invalidCategory) {
      setStatusMessage('Minden kategóriának kell nevet adni mentés előtt.')
      setIsSubmitting(false)
      return
    }

    const removedCategories = savedCategories.filter(
      (savedCategory) => !categories.some((category) => category.id === savedCategory.id),
    )

    for (const category of removedCategories) {
      const { error } = await supabase.from('budget_categories').delete().eq('id', category.id)
      if (error) {
        setStatusMessage(`Nem sikerült törölni a kategóriát: ${error.message}`)
        setIsSubmitting(false)
        return
      }
    }

    for (const category of categories) {
      const row = {
        id: category.id,
        name: category.name.trim(),
        budgeted_amount: Number(category.budgeted_amount) || 0,
        parent_id: category.parent_id || null,
        sort_order: Number(category.sort_order) || 0,
      }

      const { error } = category.isNew
        ? await supabase.from('budget_categories').insert(row)
        : await supabase.from('budget_categories').update(row).eq('id', category.id)

      if (error) {
        setStatusMessage(`Nem sikerült menteni a kategóriát: ${error.message}`)
        setIsSubmitting(false)
        return
      }
    }

    const normalizedCategories = categories.map((category) => {
      const { isNew, ...rest } = category
      return rest
    })

    setCategories(normalizedCategories)
    setSavedCategories(cloneCategories(normalizedCategories))
    setIsEditingCategories(false)
    setIsSubmitting(false)
    setViewMode('summary')
    setStatusMessage('A kategóriák mentve.')
  }

  function updateTransaction(transactionId, field, value) {
    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === transactionId ? { ...transaction, [field]: value } : transaction,
      ),
    )
  }

  function removeTransaction(transactionId) {
    setTransactions((current) =>
      current.filter((transaction) => transaction.id !== transactionId),
    )
  }

  function startTransactionEditing() {
    setSavedTransactions(cloneTransactions(transactions))
    setStatusMessage('')
    setIsEditingTransactions(true)
  }

  function discardTransactionChanges() {
    setTransactions(cloneTransactions(savedTransactions))
    setIsEditingTransactions(false)
    setStatusMessage('')
    setViewMode('transactions')
  }

  async function saveTransactionChanges() {
    setIsSubmitting(true)
    setStatusMessage('')

    const invalidTransaction = transactions.find(
      (transaction) => !transaction.category_id || !transaction.description.trim(),
    )

    if (invalidTransaction) {
      setStatusMessage('Minden tranzakcióhoz kell kategória és leírás.')
      setIsSubmitting(false)
      return
    }

    const removedTransactions = savedTransactions.filter(
      (savedTransaction) =>
        !transactions.some((transaction) => transaction.id === savedTransaction.id),
    )

    for (const transaction of removedTransactions) {
      const { error } = await supabase
        .from('budget_transactions')
        .delete()
        .eq('id', transaction.id)

      if (error) {
        setStatusMessage(`Nem sikerült törölni a tranzakciót: ${error.message}`)
        setIsSubmitting(false)
        return
      }
    }

    for (const transaction of transactions) {
      const row = {
        id: transaction.id,
        category_id: transaction.category_id,
        amount: Number(transaction.amount) || 0,
        description: transaction.description.trim(),
        transaction_date: transaction.transaction_date,
      }

      const { error } = transaction.isNew
        ? await supabase.from('budget_transactions').insert(row)
        : await supabase.from('budget_transactions').update(row).eq('id', transaction.id)

      if (error) {
        setStatusMessage(`Nem sikerült menteni a tranzakciót: ${error.message}`)
        setIsSubmitting(false)
        return
      }
    }

    const normalizedTransactions = transactions.map((transaction) => {
      const { isNew, ...rest } = transaction
      return rest
    })

    setTransactions(normalizedTransactions)
    setSavedTransactions(cloneTransactions(normalizedTransactions))
    setIsEditingTransactions(false)
    setIsSubmitting(false)
    setViewMode('summary')
    setStatusMessage('A tranzakciók mentve.')
  }

  if (isLoading) {
    return (
      <main className="budget-page">
        <section className="auth-card budget-card">
          <p className="admin-summary">Költségvetés betöltése...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="budget-page">
      <section className="auth-card budget-card">
        <p className="eyebrow">Admin</p>
        <h1>Esküvői költségvetés</h1>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <>
            <div className="budget-view-tabs">
              <button
                type="button"
                className={viewMode === 'summary' ? 'is-active' : ''}
                onClick={() => setViewMode('summary')}
              >
                Költségvetés
              </button>
              <button
                type="button"
                className={viewMode === 'transactions' ? 'is-active' : ''}
                onClick={() => {
                  setViewMode('transactions')
                  if (!isEditingTransactions) {
                    setIsEditingTransactions(false)
                  }
                }}
              >
                Tranzakciók
              </button>
            </div>

            {viewMode === 'summary' && (
              <>
                <div className="budget-overview">
                  <article className="budget-panel">
                    <h2>Tényleges összegzés</h2>
                    <DonutChart segments={donutSegments} />
                    <ul className="budget-legend">
                      {donutSegments.map((segment) => (
                        <li key={segment.label}>
                          <span style={{ background: segment.color }} />
                          {segment.label}
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="budget-panel budget-panel-wide">
                    <h2>Költségvetés és tényleges adatok</h2>
                    <div className="budget-bar-legend">
                      <span>
                        <i className="budget-bar-planned" /> Költségvetés
                      </span>
                      <span>
                        <i className="budget-bar-actual" /> Tényleges
                      </span>
                    </div>
                    <BarChart rows={summaryRows} />
                  </article>
                </div>

                <div className="budget-progress-block">
                  <div className="budget-progress-header">
                    <strong>Költségvetés kihasználtsága</strong>
                    <span>{totals.spentPercent}%</span>
                  </div>
                  <div className="budget-progress-track" aria-hidden="true">
                    <div
                      className="budget-progress-fill"
                      style={{ width: `${totals.spentPercent}%` }}
                    />
                  </div>
                  <p>
                    Tervezett: <strong>{formatCurrency(totals.budget)}</strong> · Tényleges:{' '}
                    <strong>{formatCurrency(totals.actual)}</strong> · Maradvány:{' '}
                    <strong>{formatCurrency(totals.difference)}</strong>
                  </p>
                </div>

                <div className="admin-actions">
                  <button type="button" onClick={() => setViewMode('categories')}>
                    Kategóriák szerkesztése
                  </button>
                  <button type="button" onClick={() => setViewMode('transactions')}>
                    Tranzakciók
                  </button>
                  <button type="button" onClick={openAddTransactionModal}>
                    Új tranzakció
                  </button>
                </div>

                <div className="admin-table-wrapper">
                  <table className="admin-table budget-table">
                    <thead>
                      <tr>
                        <th>Kategória</th>
                        <th>Költségvetés</th>
                        <th>Tényleges</th>
                        <th>Különbség</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.length === 0 ? (
                        <tr>
                          <td colSpan="4">Még nincs kategória. Először add hozzá a kategóriákat.</td>
                        </tr>
                      ) : (
                        summaryRows.map((category) => {
                          const childRows = category.children.map((child) => {
                            const childTotals = getCategoryTotals(child, categories, transactions)
                            return {
                              ...child,
                              budget: childTotals.budget,
                              actual: childTotals.actual,
                              difference: childTotals.budget - childTotals.actual,
                            }
                          })

                          return (
                            <Fragment key={category.id}>
                              <tr>
                                <td>
                                  {childRows.length > 0 && (
                                    <button
                                      type="button"
                                      className="budget-expand-button"
                                      aria-expanded={expandedCategoryIds.has(category.id)}
                                      onClick={() => toggleCategory(category.id)}
                                    >
                                      {expandedCategoryIds.has(category.id) ? '▾' : '▸'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="budget-category-link"
                                    onClick={() => openTransactionsForCategory(category.id)}
                                  >
                                    {category.name}
                                  </button>
                                </td>
                                <td>{formatCurrency(category.budget)}</td>
                                <td>{formatCurrency(category.actual)}</td>
                                <td>{formatCurrency(category.difference)}</td>
                              </tr>
                              {expandedCategoryIds.has(category.id) &&
                                childRows.map((child) => (
                                  <tr className="budget-subcategory-row" key={child.id}>
                                    <td>
                                      <button
                                        type="button"
                                        className="budget-category-link"
                                        onClick={() => openTransactionsForCategory(child.id)}
                                      >
                                        {child.name}
                                      </button>
                                    </td>
                                    <td>{formatCurrency(child.budget)}</td>
                                    <td>{formatCurrency(child.actual)}</td>
                                    <td>{formatCurrency(child.difference)}</td>
                                  </tr>
                                ))}
                            </Fragment>
                          )
                        })
                      )}
                    </tbody>
                    {summaryRows.length > 0 && (
                      <tfoot>
                        <tr>
                          <td>Összes kiadás</td>
                          <td>{formatCurrency(totals.budget)}</td>
                          <td>{formatCurrency(totals.actual)}</td>
                          <td>{formatCurrency(totals.difference)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}

            {viewMode === 'categories' && (
              <>
                <p className="admin-summary">
                  Itt adhatod meg a fő kategóriákat és az alkategóriákat a tervezett
                  költségvetéssel.
                </p>

                <div className="admin-actions">
                  {!isEditingCategories ? (
                    <>
                      <button type="button" onClick={startCategoryEditing}>
                        Szerkesztés
                      </button>
                      <button type="button" onClick={() => setViewMode('summary')}>
                        Vissza az összefoglalóhoz
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={saveCategoryChanges}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Mentés...' : 'Mentés'}
                      </button>
                      <button
                        type="button"
                        onClick={discardCategoryChanges}
                        disabled={isSubmitting}
                      >
                        Módosítások elvetése
                      </button>
                      <button type="button" onClick={() => addCategory()}>
                        Új fő kategória
                      </button>
                    </>
                  )}
                </div>

                <div className="admin-table-wrapper">
                  <table className="admin-table budget-table">
                    <thead>
                      <tr>
                        <th>Név</th>
                        <th>Szülő kategória</th>
                        <th>Költségvetés</th>
                        <th>Sorrend</th>
                        {isEditingCategories && <th>Művelet</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {categories.length === 0 ? (
                        <tr>
                          <td colSpan={isEditingCategories ? 5 : 4}>Még nincs kategória.</td>
                        </tr>
                      ) : (
                        getHierarchicalCategoryRows(categories).map(({ category, isSubcategory }) => (
                          <tr
                            key={category.id}
                            className={isSubcategory ? 'budget-subcategory-row' : ''}
                          >
                            <td>
                              {isEditingCategories ? (
                                <input
                                  type="text"
                                  value={category.name}
                                  onChange={(event) =>
                                    updateCategory(category.id, 'name', event.target.value)
                                  }
                                />
                              ) : (
                                category.name
                              )}
                            </td>
                            <td>
                              {isEditingCategories ? (
                                <select
                                  value={category.parent_id || ''}
                                  onChange={(event) =>
                                    updateCategory(
                                      category.id,
                                      'parent_id',
                                      event.target.value || null,
                                    )
                                  }
                                >
                                  <option value="">Fő kategória</option>
                                  {categories
                                    .filter(
                                      (item) =>
                                        !item.parent_id && item.id !== category.id,
                                    )
                                    .map((parent) => (
                                      <option value={parent.id} key={parent.id}>
                                        {parent.name || 'Névtelen kategória'}
                                      </option>
                                    ))}
                                </select>
                              ) : category.parent_id ? (
                                getCategoryLabel(category.parent_id, categories)
                              ) : (
                                'Fő kategória'
                              )}
                            </td>
                            <td>
                              {isEditingCategories ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  value={category.budgeted_amount}
                                  onChange={(event) =>
                                    updateCategory(
                                      category.id,
                                      'budgeted_amount',
                                      event.target.value,
                                    )
                                  }
                                />
                              ) : (
                                formatCurrency(category.budgeted_amount)
                              )}
                            </td>
                            <td>
                              {isEditingCategories ? (
                                <input
                                  type="number"
                                  value={category.sort_order}
                                  onChange={(event) =>
                                    updateCategory(category.id, 'sort_order', event.target.value)
                                  }
                                />
                              ) : (
                                category.sort_order
                              )}
                            </td>
                            {isEditingCategories && (
                              <td className="budget-actions-cell">
                                {!category.parent_id && (
                                  <button
                                    type="button"
                                    onClick={() => addCategory(category.id)}
                                  >
                                    Alkategória
                                  </button>
                                )}
                                <button type="button" onClick={() => removeCategory(category.id)}>
                                  Törlés
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {viewMode === 'transactions' && (
              <>
                <p className="admin-summary">
                  Itt rögzítheted az egyes kiadásokat. A tényleges összegek ezek alapján
                  számolódnak.
                </p>

                <div className="budget-filter-bar">
                  <div className="budget-filter-control">
                    <button
                      type="button"
                      className="budget-filter-trigger"
                      aria-expanded={isFilterOpen}
                      onClick={() => (isFilterOpen ? setIsFilterOpen(false) : openCategoryFilter())}
                    >
                      {appliedCategoryFilter.length === 0
                        ? 'Szűrés kategória szerint'
                        : `Szűrve: ${appliedCategoryFilter.length} kategória`}
                    </button>

                    {isFilterOpen && (
                      <div className="budget-filter-dropdown" role="dialog" aria-label="Kategória szűrő">
                        <p>Válassz egy vagy több kategóriát, majd OK.</p>
                        <div className="budget-filter-options">
                          {leafCategories.length === 0 ? (
                            <p>Nincs választható kategória.</p>
                          ) : (
                            leafCategories.map((category) => {
                              const checked = draftCategoryFilter.includes(category.id)

                              return (
                                <label key={category.id}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleDraftFilterCategory(category.id)}
                                  />
                                  <span>{getCategoryLabel(category.id, categories)}</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                        <div className="budget-filter-actions">
                          <button type="button" onClick={applyCategoryFilter}>
                            OK
                          </button>
                          <button type="button" onClick={clearCategoryFilter}>
                            Összes
                          </button>
                          <button type="button" onClick={() => setIsFilterOpen(false)}>
                            Mégse
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {appliedCategoryFilter.length > 0 && (
                    <p className="budget-filter-summary">
                      Megjelenítve:{' '}
                      {appliedCategoryFilter
                        .map((id) => getCategoryLabel(id, categories))
                        .join(', ')}
                    </p>
                  )}
                </div>

                <div className="admin-actions">
                  {!isEditingTransactions ? (
                    <>
                      <button type="button" onClick={startTransactionEditing}>
                        Tranzakciók szerkesztése
                      </button>
                      <button type="button" onClick={openAddTransactionModal}>
                        Új tranzakció hozzáadása
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={saveTransactionChanges}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Mentés...' : 'Mentés'}
                      </button>
                      <button
                        type="button"
                        onClick={discardTransactionChanges}
                        disabled={isSubmitting}
                      >
                        Módosítások elvetése
                      </button>
                      <button type="button" onClick={openAddTransactionModal}>
                        Új tranzakció hozzáadása
                      </button>
                    </>
                  )}
                </div>

                <div className="admin-table-wrapper">
                  <table className="admin-table budget-table">
                    <thead>
                      <tr>
                        <th>Dátum</th>
                        <th>Kategória</th>
                        <th>Leírás</th>
                        <th>Összeg</th>
                        {isEditingTransactions && <th>Művelet</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={isEditingTransactions ? 5 : 4}>
                            {transactions.length === 0
                              ? 'Még nincs tranzakció.'
                              : 'Nincs a szűrésnek megfelelő tranzakció.'}
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td>
                              {isEditingTransactions ? (
                                <input
                                  type="date"
                                  value={transaction.transaction_date}
                                  onChange={(event) =>
                                    updateTransaction(
                                      transaction.id,
                                      'transaction_date',
                                      event.target.value,
                                    )
                                  }
                                />
                              ) : (
                                transaction.transaction_date
                              )}
                            </td>
                            <td>
                              {isEditingTransactions ? (
                                <select
                                  value={transaction.category_id}
                                  onChange={(event) =>
                                    updateTransaction(
                                      transaction.id,
                                      'category_id',
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">Válassz kategóriát</option>
                                  {leafCategories.map((category) => (
                                    <option value={category.id} key={category.id}>
                                      {getCategoryLabel(category.id, categories)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                getCategoryLabel(transaction.category_id, categories)
                              )}
                            </td>
                            <td>
                              {isEditingTransactions ? (
                                <input
                                  type="text"
                                  value={transaction.description}
                                  onChange={(event) =>
                                    updateTransaction(
                                      transaction.id,
                                      'description',
                                      event.target.value,
                                    )
                                  }
                                />
                              ) : (
                                transaction.description
                              )}
                            </td>
                            <td>
                              {isEditingTransactions ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  value={transaction.amount}
                                  onChange={(event) =>
                                    updateTransaction(
                                      transaction.id,
                                      'amount',
                                      event.target.value,
                                    )
                                  }
                                />
                              ) : (
                                formatCurrency(transaction.amount)
                              )}
                            </td>
                            {isEditingTransactions && (
                              <td>
                                <button
                                  type="button"
                                  onClick={() => removeTransaction(transaction.id)}
                                >
                                  Törlés
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {isAddModalOpen && newTransaction && (
          <div
            className="budget-modal-backdrop"
            role="presentation"
            onClick={closeAddTransactionModal}
          >
            <div
              className="budget-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="budget-new-transaction-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="budget-new-transaction-title">Új tranzakció</h2>

              <label>
                Dátum
                <input
                  type="date"
                  value={newTransaction.transaction_date}
                  onChange={(event) =>
                    updateNewTransactionField('transaction_date', event.target.value)
                  }
                />
              </label>

              <label>
                Kategória
                <select
                  value={newTransaction.category_id}
                  onChange={(event) =>
                    updateNewTransactionField('category_id', event.target.value)
                  }
                >
                  <option value="">Válassz kategóriát</option>
                  {leafCategories.map((category) => (
                    <option value={category.id} key={category.id}>
                      {getCategoryLabel(category.id, categories)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Leírás
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(event) =>
                    updateNewTransactionField('description', event.target.value)
                  }
                  placeholder="Pl. foglaló, virágok..."
                />
              </label>

              <label>
                Összeg
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={newTransaction.amount}
                  onChange={(event) => updateNewTransactionField('amount', event.target.value)}
                />
              </label>

              <div className="budget-modal-actions">
                <button type="button" onClick={saveNewTransaction} disabled={isSubmitting}>
                  {isSubmitting ? 'Mentés...' : 'Mentés'}
                </button>
                <button type="button" onClick={closeAddTransactionModal} disabled={isSubmitting}>
                  Mégse
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="auth-switch">
          <Link to="/admin">Vissza a vendéglistához</Link>
        </p>
      </section>
    </main>
  )
}
