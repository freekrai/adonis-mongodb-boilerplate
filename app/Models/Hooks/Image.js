const fs = use('fs')
const Helpers = use('Helpers')
const ImageHooks = exports = module.exports = {}

ImageHooks.removeFile = async (next) => {
  fs.unlinkSync(Helpers.publicPath(`uploads/${this.fileName}`))
  await next
}
