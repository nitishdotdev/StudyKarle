function health(req, res) {
  res.status(200).json({
    success: true,
    data: { status: "ok" },
  });
}

module.exports = {
  health: health,
};
