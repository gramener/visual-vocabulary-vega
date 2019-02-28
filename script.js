/* globals vega, g1, vegaTooltip */

var APP = {T: {}, data: {}}
document.querySelectorAll('script[type="text/html"]').forEach(el => {
  APP.T[el.className] = _.template(el.innerHTML)
})

Promise.all([fetchCSV('./spec/index.csv'), fetchCSV('./spec/indexlist.csv')])
  .then(arr => {
    APP.data['index'] = arr[0]
    APP.data['indexlist'] = arr[1]
    draw()
  }).catch(err => { console.log(err) } )

window.addEventListener('hashchange', draw)
window.addEventListener('resize', _.debounce(resize, 50))

function fetchCSV(url) {
  return vega.loader().load(url)
    .then(data => { return vega.read(data, {type: 'csv', parse: 'auto'}) })
}

function draw() {
  APP.path = location.hash.slice(1).replace(/\//g, '')
  var tmpl = (APP.path)?'panel':'index'
  document.querySelector('.main').innerHTML = APP.T[tmpl]({APP})
  if (APP.path) {
    document.querySelectorAll('.vegachart').forEach(el => {
      vega.loader()
      .load(el.getAttribute('data-vg'))
      .then(data => { render(el, JSON.parse(data)) })
      
    })
    document.querySelectorAll('.posteditor').forEach(el => {
      el.addEventListener('click', event => {
        var spec = event.target.closest('.box').querySelector('.vegachart').spec.spec
        setDataURL(spec)
        postEditor('https://vega.github.io/editor/', {spec: JSON.stringify(spec)})
      })
    })
  }
}

function setDataURL(spec) {
  spec.data.forEach(d => {
    if ('url' in d) {
      d.url = window.location.origin + window.location.pathname + d.url.replace('./', '')
    }
  })
}

function render(el, spec) {
  delete spec.title
  var tooltip = new vegaTooltip.Handler()
  var view = new vega.View(vega.parse(spec))
    .logLevel(vega.Warn)
    .renderer('svg')  // set renderer (canvas or svg)
    .initialize(el)   // initialize view within parent DOM container
    .hover()          // enable hover encode set processing
    .tooltip(tooltip.call)
    .run();

  el.spec = {'view': view, 'spec': spec}
  _resizeVega(el)
}

function _resizeVega(el) {
  // TODO: check containerSize https://vega.github.io/vega/docs/expressions/#containerSize
  var view = el.spec.view
  if (!el.getAttribute('data-width'))
    view.width(el.clientWidth)
  if (!el.getAttribute('data-height'))
    view.height(view.height() || el.clientHeight)
  view.run()
}

function resize() {
  document.querySelectorAll('.vegachart').forEach(function(x) {
    _resizeVega(x)
  })
}

function postEditor(url, data) {
  // postEditor('https://vega.github.io/editor/', {spec: JSON.stringify(spec)})
  data = Object.assign({}, data, {config: {}, mode: 'vega', renderer: 'svg'})
  var editor = window.open(url)
  var wait = 10000, step = 250, count = ~~(wait / step)
  function listen(evt) {
    if (evt.source === editor) {
      count = 0
      window.removeEventListener('message', listen, false)
    }
  }
  window.addEventListener('message', listen, false)
  // send message; periodically resend until ack received or timeout
  function send() {
    if (count <= 0) { return }
    editor.postMessage(data, '*')
    setTimeout(send, step)
    count -= 1
  }
  setTimeout(send, step)
}