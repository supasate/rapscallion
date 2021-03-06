/* global setImmediate */
const Promise = require("bluebird");

const { EXHAUSTED } = require("../sequence");
const {
  pullBatch,
  getReactIdPushable,
  getChecksumWrapper,
  INCOMPLETE
} = require("./common");


const TAG_END = /\/?>/;
const COMMENT_START = /^<\!\-\-/;


// eslint-disable-next-line max-params
function asyncBatch (
  sequence,
  batchSize,
  pushable,
  dataReactAttrs,
  resolve
) {
  const result = pullBatch(sequence, batchSize, pushable);
  if (result === INCOMPLETE) {
    setImmediate(asyncBatch, sequence, batchSize, pushable, dataReactAttrs, resolve);
  } else if (result === EXHAUSTED) {
    resolve();
  } else if (result instanceof Promise) {
    result.then(next => {
      pushable.push(next);
      setImmediate(asyncBatch, sequence, batchSize, pushable, dataReactAttrs, resolve);
    });
  }
}

/**
 * Consumes the provided sequence and returns a promise with the concatenation of all
 * sequence segments.
 *
 * @param      {Sequence}  sequence        Source sequence.
 * @param      {Integer}   batchSize       The number of HTML segments to render
 *                                         before passing control back to the event loop.
 * @param      {Boolean}   dataReactAttrs  Indicates whether data-react* attrs should be
 *                                         rendered.
 *
 * @return     {Promise}                   A promise resolving to the HTML string.
 */
function toPromise (sequence, batchSize, dataReactAttrs) {
  const buffer = {
    value: "",
    push (segment) { this.value += segment; }
  };
  const checksumWrapper = getChecksumWrapper(buffer);
  const reactIdPushable = getReactIdPushable(checksumWrapper, 1, dataReactAttrs);

  return new Promise(resolve =>
    setImmediate(
      asyncBatch,
      sequence,
      batchSize,
      reactIdPushable,
      dataReactAttrs,
      resolve
    )
  ).then(() => {
    let html = buffer.value;

    if (dataReactAttrs && !COMMENT_START.test(html)) {
      const checksum = checksumWrapper.checksum();
      html = html.replace(TAG_END, ` data-react-checksum="${checksum}"$&`);
    }

    return html;
  });
}


module.exports = toPromise;
