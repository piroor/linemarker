# 更新履歴

 - master/HEAD
   * jarファイルを含めない形のパッケージングに変更
   * 細かい修正色々（詳しくは[コミットログ](https://github.com/piroor/linemarker/commits/master)を参照）
 - 2.0.2009110201
   * Firefox 3.6およびMinefieldにインストールできるようにした
 - 2.0.2008040701
   * Firefox 3 beta5での動作を確認
 - 2.0.2006072201
   * バックグラウンドで読み込んだタブに対してマーカーが復元されない問題を修正
   * ページ読み込み直後のマーカー復元に失敗してマーカーの情報が失われてしまうことがある問題について改善
   * 複数のノードに跨るマーカーについて、マーカー中のノードの切れ目でマーカーが切れてしまっているように見える問題を修正
   * マーカーの中にマーカーを設定しようとするとハングアップしてしまう問題を修正
   * マーカーの中にマーカーがある場合、親のマーカーを消すと子孫のマーカーも消すようにした（暫定措置。将来的には、子孫のマーカーを維持できるようにしたい。）
   * 実装方法を改善
 - 2.0.20060413
   * ホワイトスペースのみのテキストノードにはマーカーを適用しないようにした
   * デフォルトのマーカーの種類を増やした
   * 設定したマーカーを記憶できるようにした
   * 設定したマーカーを個別に削除できるようにした
 - 1.1.20050518
   * 初回起動時にマーカーを設定できない問題を修正
 - 1.1.20050518
   * マーカーを消去できなくなっていたのを修正
 - 1.1.20050418
   * よりセキュアな方法で内容領域へアクセスするようにした
 - 1.1.20041216
   * ページ全体を選択しているとエラーになる問題を修正
   * Movable Type 3.0の管理画面などにおいてコンテキストメニューの初期化に失敗する問題を修正
 - 1.1.20040705
   * デフォルトのカラーセットが生成されない問題を修正
 - 1.1.20040621
   * window.topが変数になっている時にエラーが起こる可能性があったのを修正
   * デフォルトのカラーセットがいつの間にか使えなくなってしまっていたのを修正
 - 1.1.20030317
   * コンテキストメニューの初期化でエラーを起こすことがあったのを修正
   * デフォルトの色設定ファイルを言語ごとに分けた
   * プロファイル内にインストールできるようにした
 - 1.0.20021004
   * Phoenixに対応
 - 1.0.20020905
   * フレームに対応
 - 1.0.20020902
   * 単一のテキストノードを部分選択した場合に色を付けられなかった問題を修正
   * デフォルトのカラーセットも編集できるようにした
 - 1.0.20020828
   * 公開
