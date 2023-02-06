import { Chess } from "./chess.js-0.13.4/chess.js";
import * as io from "./socket.io-client-4.5.4/dist/socket.io.js";
import openings from "./eco.js";

/** @type {Chess} */
var chess;
var board;
var whiteSquareGrey = "#a9a9a9";
var blackSquareGrey = "#696969";
let side;
let code;

document.getElementById("game").style.display = "none";

const socket = window.io("ws://en-passant.fly.dev:8080");

socket.on("connected", (...args) => {
  console.log("Connected!");
  $("#gameOver").modal("show");
  $("#reason").text("Checkmate - White wins!");
});

socket.on("connect_error", (err) => {
  document.getElementById("status").innerText =
    "Connection failed. Please try later.";
});

socket.on("joined", (...args) => {
  document.getElementById("status").innerText =
    "Waiting for other player to join...";
  document.getElementById("joinRoom").disabled = true;
});

document.getElementById("joinRoom").addEventListener("click", () => {
  code = document.getElementById("roomInput").value;
  socket.emit("join", code, (response) => {
    if (response.status == "failed") {
      document.getElementById("status").innerText = "Room was full.";
    }
  });
});

socket.on("started", (...args) => {
  document.getElementById("status").innerText = "";
  side = args[0].players.w == socket.id ? "w" : "b";
  chess = new Chess();

  board = Chessboard("board", {
    position: "start",
    orientation: side == "w" ? "white" : "black",
    draggable: true,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onMouseoutSquare: onMouseoutSquare,
    onMouseoverSquare: onMouseoverSquare,
    onSnapEnd: onSnapEnd,
  });

  document.getElementById("menu").style.display = "none";
  document.getElementById("game").style.display = "block";
});

socket.on("moved", (...args) => {
  chess.move(args[0].move);
  board.position(chess.fen());

  renderMove(args[0].move);

  if (chess.game_over()) {
    var reason;

    if (chess.in_checkmate()) {
      switch (chess.turn()) {
        case "b":
          reason = "Checkmate: Black wins!";
        case "w":
          reason = "Checkmate: White wins!";
      }
    } else {
      reason = chess.insufficient_material()
        ? "Draw: Insufficient Material"
        : chess.is_stalemate()
        ? "Draw: Stalemate"
        : chess.in_threefold_repetition()
        ? "Draw: Repetition"
        : "Draw";
    }

    socket.emit("gameOver", { code: 12345, reason: reason });
  }
});

function removeGreySquares() {
  $("#board .square-55d63").css("background", "");
}

function greySquare(square) {
  var $square = $("#board .square-" + square);

  var background = whiteSquareGrey;
  if ($square.hasClass("black-3c85d")) {
    background = blackSquareGrey;
  }

  $square.css("background", background);
}

function onDragStart(source, piece, position, orientation) {
  if (chess.game_over()) return false;
  if (chess.turn() != side) return false;
  if (
    (chess.turn() === "w" && piece.search(/^b/) !== -1) ||
    (chess.turn() === "b" && piece.search(/^w/) !== -1)
  )
    return false;
}

function renderMove(san) {
  var audio;
  if (chess.in_check()) {
    audio = new Audio("check.wav");
  } else {
    audio = new Audio("click.wav");
  }
  audio.play();

  if (chess.turn() === "b") {
    $("#moves").append(
      `<li class="list-group-item">${$("#moves li").length + 1}. ${san}</li>`
    );
  } else {
    $("#moves li")
      .last()
      .append(" / " + san);
  }

  var x = openings.openings.find((element) => {
    return element.fen == chess.fen().split(" ").slice(0, 3).join(" ");
  });

  if (x) {
    $("#opening").text(x.name);
  }
}

function onDrop(source, target) {
  removeGreySquares();

  var move = chess.move({
    from: source,
    to: target,
    promotion: "q",
  });

  if (move === null) return "snapback";

  renderMove(move.san);

  socket.emit("move", { code: code, move: move.san });
}

function onMouseoverSquare(square, piece) {
  if (chess.game_over()) return false;
  if (chess.turn() != side) return false;

  var moves = chess.moves({
    square: square,
    verbose: true,
  });

  if (moves.length === 0) return;

  greySquare(square);

  moves.forEach((element) => {
    greySquare(element.to);
  });
}

socket.on("gameOvered", (...args) => {
  $("gameOver").modal("show");

  document.getElementById("menu").style.display = "block";
  document.getElementById("game").style.display = "none";
  document.getElementById("joinRoom").disabled = false;
  console.log(`Game ended: ${reason}.`);
});

function onMouseoutSquare(square, piece) {
  removeGreySquares();
}

function onSnapEnd() {
  board.position(chess.fen());
}
