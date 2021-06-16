import React from "react";
import { Router, Link, BrowserRouter, Route, Switch } from "react-router-dom";
import home from "./pages/home";
import about from "./pages/about";

const App = () => {
  return (
    <div className="wrap">
      <BrowserRouter>
        <div>
          <Link to="/home">home</Link>
          <span> | </span>
          <Link to="/about">about</Link>
        </div>
        <Switch>
          <Route path="/home" component={home}></Route>
          <Route path="/about" component={about}></Route>
          <Route path="/" component={home}></Route>
        </Switch>
      </BrowserRouter>
    </div>
  );
};

export default App;
