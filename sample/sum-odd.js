#!/usr/bin/env rhino

var kei = 0;
for (var i = 1; i <= 100; i++) {
  if (i % 2 == 1) {
    kei += i;
  }
}
print(kei);

