/* Catalog filtering. The product data itself comes from the database and is embedded in the page. */
(function (root) {
  'use strict';
  function selectProducts(products, { category = 'alle', sort = 'featured', query = '', maxPrice = Infinity } = {}) {
    const term = query.trim().toLocaleLowerCase('nl');
    const result = products.filter(p => (category === 'alle' || p.category === category) && p.price <= maxPrice && `${p.name} ${p.description} ${(p.features || []).join(' ')}`.toLocaleLowerCase('nl').includes(term));
    if (sort === 'price-asc') result.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') result.sort((a, b) => b.price - a.price);
    if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
    return result;
  }
  const catalog = { selectProducts };
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
  else root.RaytrixCatalog = catalog;
})(typeof window !== 'undefined' ? window : globalThis);
